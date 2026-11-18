import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { asSystem } from "./db";
import { env, hasDb } from "./env";
import { sha256, token } from "./crypto";
import { clientIp } from "./http";

/**
 * Sessions: a long random token in an HttpOnly, Secure, SameSite=Lax cookie. JavaScript can't read it,
 * other sites can't send it on their forms, and the database stores only its SHA-256 hash, so a database
 * leak doesn't leak working sessions. Nothing about the session is kept in localStorage.
 */
export const SESSION_COOKIE = env.isProd ? "__Host-nea_session" : "nea_session";
const DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "member" | "staff" | "admin";
  status: "active" | "pending_parent" | "disabled";
  birthYm: string | null;
  marketing: boolean;
  clubCode: string;
};
export type Session = { id: string; user: SessionUser; mfaOk: boolean };

const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: env.isProd, sameSite: "lax" as const, path: "/", maxAge });

export async function createSession(userId: string, req: Request, mfaOk = false) {
  const t = token(32);
  await asSystem((q) =>
    q(`INSERT INTO sessions (user_id, token_hash, mfa_ok, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`, [
      userId,
      sha256(t),
      mfaOk,
      clientIp(req),
      (req.headers.get("user-agent") || "").slice(0, 200),
      DAYS,
    ]),
  );
  await asSystem((q) => q("UPDATE users SET last_seen_at = now() WHERE id = $1", [userId]));
  (await cookies()).set(SESSION_COOKIE, t, cookieOpts(DAYS * 86400));
}

/** The current visitor's session, or null. Cached for the rest of this request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!hasDb()) return null;
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t || t.length > 100) return null;
  const rows = await asSystem((q) =>
    q<{
      sid: string;
      mfa_ok: boolean;
      stale: boolean;
      id: string;
      email: string;
      name: string;
      role: SessionUser["role"];
      status: SessionUser["status"];
      birth_ym: string | null;
      marketing: boolean;
      club_code: string;
    }>(
      `SELECT s.id AS sid, s.mfa_ok, (s.last_used_at < now() - interval '1 day') AS stale,
              u.id, u.email, u.name, u.role, u.status, u.birth_ym, u.marketing, u.club_code
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status <> 'disabled'`,
      [sha256(t)],
    ),
  ).catch(() => []);
  const r = rows[0];
  if (!r) return null;
  if (r.stale) {
    // sliding expiry: active members stay signed in
    await asSystem((q) => q("UPDATE sessions SET last_used_at = now(), expires_at = now() + make_interval(days => $2) WHERE id = $1", [r.sid, DAYS])).catch(() => {});
  }
  return {
    id: r.sid,
    mfaOk: r.mfa_ok,
    user: { id: r.id, email: r.email, name: r.name, role: r.role, status: r.status, birthYm: r.birth_ym, marketing: r.marketing, clubCode: r.club_code },
  };
});

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await asSystem((q) => q("DELETE FROM sessions WHERE token_hash = $1", [sha256(t)])).catch(() => {});
  jar.set(SESSION_COOKIE, "", cookieOpts(0));
}

/** Signs the user out everywhere (after a role change, MFA reset or account delete). */
export const destroyAllSessions = (userId: string) => asSystem((q) => q("DELETE FROM sessions WHERE user_id = $1", [userId]));

/** A member who may save data (parent consent done, if under 18). */
export async function requireUser(): Promise<Session | null> {
  const s = await getSession();
  return s && s.user.status === "active" ? s : null;
}

/** Staff or admin who has passed two-step sign-in in this session. */
export async function requireStaff(): Promise<Session | null> {
  const s = await getSession();
  return s && s.user.status === "active" && (s.user.role === "staff" || s.user.role === "admin") && s.mfaOk ? s : null;
}

export async function requireAdmin(): Promise<Session | null> {
  const s = await requireStaff();
  return s && s.user.role === "admin" ? s : null;
}

/**
 * Age in whole years from 'YYYY-MM'. We only know the month, so the birthday counts as reached once that
 * month is over (the strict side): someone can never get in before they really turn 16 or 18.
 */
export function ageFrom(birthYm: string, now = new Date()) {
  const [y, m] = birthYm.split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 <= m) age--;
  return age;
}

export const MIN_AGE = 16;
export const ADULT_AGE = 18;
export const PRIVACY_VERSION = "2026-11";
