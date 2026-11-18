import "server-only";
import { cookies } from "next/headers";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { asSystem } from "./db";
import { decrypt, encrypt, hashSecret, sha256, token } from "./crypto";
import { SESSION_COOKIE, createSession, getSession, type Session } from "./auth";
import { hit, over } from "./rate-limit";

/**
 * Staff two-step sign-in (TOTP: Google Authenticator, Microsoft Authenticator, 1Password …).
 * A staff member signs in with their email code first, then must enter the 6-digit app code.
 * Only then is the session marked mfa_ok, which every staff page and API checks.
 */
authenticator.options = { window: 1, step: 30 };

/** Signed in as staff or admin, but two-step sign-in not done yet in this session. */
export async function staffBeforeMfa(): Promise<Session | null> {
  const s = await getSession();
  return s && s.user.status === "active" && (s.user.role === "staff" || s.user.role === "admin") ? s : null;
}

export async function mfaState(userId: string): Promise<"none" | "unconfirmed" | "ready"> {
  const rows = await asSystem((q) => q<{ confirmed_at: string | null }>("SELECT confirmed_at FROM staff_mfa WHERE user_id = $1", [userId]));
  return !rows[0] ? "none" : rows[0].confirmed_at ? "ready" : "unconfirmed";
}

/** Makes (or re-shows, until confirmed) the secret and its QR code. */
export async function mfaSetup(s: Session) {
  const state = await mfaState(s.user.id);
  if (state === "ready") return null;
  let secret: string;
  if (state === "unconfirmed") {
    const [r] = await asSystem((q) => q<{ secret_enc: string }>("SELECT secret_enc FROM staff_mfa WHERE user_id = $1", [s.user.id]));
    secret = decrypt(r.secret_enc);
  } else {
    secret = authenticator.generateSecret(20);
    await asSystem((q) => q("INSERT INTO staff_mfa (user_id, secret_enc) VALUES ($1, $2)", [s.user.id, encrypt(secret)]));
  }
  const uri = authenticator.keyuri(s.user.email, "NEA Precision Skin staff", secret);
  return { qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }), secret };
}

/** Checks the app code (or a one-time backup code). On success marks this session as two-step verified. */
export async function mfaVerify(s: Session, code: string, req: Request): Promise<{ ok: boolean; locked?: boolean; backupCodes?: string[] }> {
  // 5 wrong codes per staff member → locked for 15 minutes, from any number of IPs
  const lockKey = `mfafail:${s.user.id}`;
  if (await over(lockKey, 5)) return { ok: false, locked: true };
  const [r] = await asSystem((q) =>
    q<{ secret_enc: string; confirmed_at: string | null; last_step: string }>("SELECT secret_enc, confirmed_at, last_step FROM staff_mfa WHERE user_id = $1", [s.user.id]),
  );
  if (!r) return { ok: false };
  const clean = code.replace(/\s/g, "");
  let ok = false;
  if (/^\d{6}$/.test(clean)) {
    const delta = authenticator.checkDelta(clean, decrypt(r.secret_enc));
    if (delta !== null) {
      const step = Math.floor(Date.now() / 30_000) + delta;
      // each 30-second code works once: it must be newer than the last one used
      if (step > Number(r.last_step)) {
        const used = await asSystem((q) => q("UPDATE staff_mfa SET last_step = $2 WHERE user_id = $1 AND last_step < $2 RETURNING user_id", [s.user.id, step]));
        ok = used.length === 1;
      }
    }
  } else if (r.confirmed_at && /^[A-Za-z0-9-]{10,24}$/.test(clean)) {
    // a backup code is removed in the same statement that checks it, so it can't be used twice
    const used = await asSystem((q) =>
      q("UPDATE staff_mfa SET backup_hashes = array_remove(backup_hashes, $2) WHERE user_id = $1 AND $2 = ANY(backup_hashes) RETURNING user_id", [s.user.id, hashSecret(clean.toUpperCase())]),
    );
    ok = used.length === 1;
  }
  if (!ok) {
    await hit(lockKey, 5, 15 * 60_000);
    return { ok: false };
  }
  let backupCodes: string[] | undefined;
  const t = (await cookies()).get(SESSION_COOKIE)?.value || "";
  await asSystem(async (q) => {
    if (!r.confirmed_at) {
      backupCodes = Array.from({ length: 10 }, () => token(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase());
      await q("UPDATE staff_mfa SET confirmed_at = now(), backup_hashes = $2 WHERE user_id = $1", [s.user.id, backupCodes.map((c) => hashSecret(c))]);
    }
    // the old session ends here …
    await q("DELETE FROM sessions WHERE token_hash = $1 AND user_id = $2", [sha256(t), s.user.id]);
  });
  // … and a brand-new token is issued with two-step done (no session fixation)
  await createSession(s.user.id, req, true);
  return { ok: true, backupCodes };
}
