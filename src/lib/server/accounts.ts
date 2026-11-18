import "server-only";
import { cookies } from "next/headers";
import { asSystem } from "./db";
import { env } from "./env";
import { hashSecret, safeEqual, seal, sixDigits, token, unseal } from "./crypto";
import { mailCode, mailParent } from "./email";
import { hit, over } from "./rate-limit";
import { clientIp } from "./http";
import { ADULT_AGE, MIN_AGE, PRIVACY_VERSION, ageFrom, createSession, destroyAllSessions } from "./auth";

/* ───────── Email codes ───────── */

const CODE_MINUTES = 10;
const MAX_TRIES = 5;

/** Sends a 6-digit code. Always answers the same way, so nobody can test which emails have accounts. */
export async function requestCode(email: string, req: Request): Promise<"ok" | "limited"> {
  const ip = clientIp(req);
  if (!(await hit(`code:email:${email}`, 5, 15 * 60_000)) || !(await hit(`code:ip:${ip}`, 20, 15 * 60_000))) return "limited";
  const code = sixDigits();
  await asSystem((q) =>
    q("INSERT INTO login_codes (email, code_hash, expires_at, ip) VALUES ($1, $2, now() + make_interval(mins => $3), $4)", [email, hashSecret(`${email}:${code}`), CODE_MINUTES, ip]),
  );
  await mailCode(email, code);
  return "ok";
}

/** Checks a code: newest unused one for this email, 10 minutes, 5 tries, then it's burnt. */
const DAY = 24 * 60 * 60_000;
const FAILS_PER_DAY = 20;

export async function verifyCode(email: string, code: string, req: Request): Promise<"ok" | "wrong" | "limited"> {
  if (!(await hit(`verify:ip:${clientIp(req)}`, 30, 15 * 60_000))) return "limited";
  // no more than 20 wrong codes per email per day, from any number of IPs: guessing can't add up over time
  if (await over(`codefail:${email}`, FAILS_PER_DAY)) return "limited";
  const r = await asSystem(async (q) => {
    const rows = await q<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM login_codes
        WHERE lower(email) = $1 AND used_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email],
    );
    const row = rows[0];
    if (!row || row.attempts >= MAX_TRIES) return "wrong" as const;
    if (!safeEqual(row.code_hash, hashSecret(`${email}:${code}`))) {
      await q("UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      return "wrong" as const;
    }
    await q("UPDATE login_codes SET used_at = now() WHERE id = $1", [row.id]);
    return "ok" as const;
  });
  if (r === "wrong") await hit(`codefail:${email}`, FAILS_PER_DAY, DAY);
  return r;
}

/* ───────── Signing in an existing person, or starting sign-up ───────── */

export type Proof = { email: string; provider: "email" | "google" | "apple"; sub: string; name?: string };
const SIGNUP_COOKIE = env.isProd ? "__Host-nea_signup" : "nea_signup";

/** After the email (or Google / Apple) is proven: sign in if the person exists, otherwise start sign-up. */
export async function signInOrStart(proof: Proof, req: Request): Promise<"signed-in" | "needs-profile" | "blocked"> {
  const user = await asSystem(async (q) => {
    const byIdentity = await q<{ id: string }>("SELECT user_id AS id FROM auth_identities WHERE provider = $1 AND provider_sub = $2", [proof.provider, proof.sub]);
    if (byIdentity[0]) return byIdentity[0];
    const byEmail = await q<{ id: string; role: string }>("SELECT id, role FROM users WHERE lower(email) = $1", [proof.email]);
    if (byEmail[0]) {
      // Staff accounts never get a new Google/Apple sign-in added automatically: they sign in with their email code.
      if (byEmail[0].role !== "member" && proof.provider !== "email") return "blocked" as const;
      // same verified email, new sign-in method: link it
      await q("INSERT INTO auth_identities (user_id, provider, provider_sub) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [byEmail[0].id, proof.provider, proof.sub]);
      return byEmail[0];
    }
    return null;
  });
  if (user === "blocked") return "blocked";
  if (user) {
    await createSession(user.id, req);
    return "signed-in";
  }
  (await cookies()).set(SIGNUP_COOKIE, seal(proof, 30 * 60, "signup"), { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: 30 * 60 });
  return "needs-profile";
}

export async function pendingSignup(): Promise<Proof | null> {
  return unseal<Proof>((await cookies()).get(SIGNUP_COOKIE)?.value, "signup");
}

export type Profile = { name: string; birthYm: string; privacy: true; marketing: boolean; parentEmail?: string };

export async function completeSignup(p: Profile, req: Request): Promise<{ ok: true; status: "active" | "pending_parent" } | { ok: false; error: string }> {
  const proof = await pendingSignup();
  if (!proof) return { ok: false, error: "Your sign-up timed out. Please start again." };
  const age = ageFrom(p.birthYm);
  if (age < MIN_AGE) return { ok: false, error: `You need to be ${MIN_AGE} or older to create an account.` };
  if (age > 110) return { ok: false, error: "Please check your birth year." };
  const minor = age < ADULT_AGE;
  if (minor && (!p.parentEmail || p.parentEmail === proof.email)) return { ok: false, error: "Please enter a parent's email (not your own)." };

  const ip = clientIp(req);
  const consentToken = minor ? token(32) : null;
  const userId = await asSystem(async (q) => {
    const exists = await q<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1", [proof.email]);
    if (exists[0]) return null;
    const [u] = await q<{ id: string }>("INSERT INTO users (email, name, birth_ym, status, marketing) VALUES ($1, $2, $3, $4, $5) RETURNING id", [
      proof.email,
      p.name,
      p.birthYm,
      minor ? "pending_parent" : "active",
      minor ? false : p.marketing,
    ]);
    await q("INSERT INTO auth_identities (user_id, provider, provider_sub) VALUES ($1, $2, $3)", [u.id, proof.provider, proof.sub]);
    await q("INSERT INTO consents (user_id, kind, version, given, ip) VALUES ($1, 'privacy', $2, true, $3)", [u.id, PRIVACY_VERSION, ip]);
    // minors don't get marketing; a parent can't be asked to approve ads
    await q("INSERT INTO consents (user_id, kind, version, given, ip) VALUES ($1, 'marketing', $2, $3, $4)", [u.id, PRIVACY_VERSION, minor ? false : p.marketing, ip]);
    if (minor && consentToken) {
      await q("INSERT INTO parent_consents (child_user_id, parent_email, token_hash, expires_at, ip) VALUES ($1, $2, $3, now() + interval '7 days', $4)", [
        u.id,
        p.parentEmail,
        hashSecret(consentToken),
        ip,
      ]);
    }
    return u.id;
  });
  if (!userId) return { ok: false, error: "That email already has an account. Please sign in." };
  if (minor && consentToken && p.parentEmail) await mailParent(p.parentEmail, p.name, `${env.siteUrl}/account/parent?t=${encodeURIComponent(consentToken)}`);
  (await cookies()).set(SIGNUP_COOKIE, "", { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", maxAge: 0 });
  await createSession(userId, req);
  return { ok: true, status: minor ? "pending_parent" : "active" };
}

/* ───────── Parent consent ───────── */

export async function parentRequest(t: string) {
  if (!t || t.length > 100) return null;
  const rows = await asSystem((q) =>
    q<{ id: string; child_user_id: string; name: string; consented_at: string | null }>(
      `SELECT pc.id, pc.child_user_id, u.name, pc.consented_at FROM parent_consents pc JOIN users u ON u.id = pc.child_user_id
        WHERE pc.token_hash = $1 AND pc.expires_at > now()`,
      [hashSecret(t)],
    ),
  );
  return rows[0] ?? null;
}

export async function parentDecide(t: string, yes: boolean, req: Request): Promise<boolean> {
  const r = await parentRequest(t);
  if (!r || r.consented_at) return false;
  await asSystem(async (q) => {
    if (yes) {
      await q("UPDATE parent_consents SET consented_at = now(), ip = $2 WHERE id = $1", [r.id, clientIp(req)]);
      await q("UPDATE users SET status = 'active' WHERE id = $1 AND status = 'pending_parent'", [r.child_user_id]);
      await q("INSERT INTO consents (user_id, kind, version, given, ip) VALUES ($1, 'parent', $2, true, $3)", [r.child_user_id, PRIVACY_VERSION, clientIp(req)]);
    } else {
      await q("DELETE FROM users WHERE id = $1 AND status = 'pending_parent'", [r.child_user_id]);
    }
  });
  if (!yes) await destroyAllSessions(r.child_user_id).catch(() => {});
  return true;
}
