import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hmac = (key: string, s: string) => createHmac("sha256", key).update(s).digest("hex");
export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
/** A 6-digit code from a secure random source. */
export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Codes and one-time tokens are stored only as a keyed hash (pepper lives in the server env, not the database). */
export const hashSecret = (s: string) => hmac(env.authPepper, s);

function encKey() {
  const k = Buffer.from(env.dataEncKey, "base64");
  if (k.length !== 32) throw new Error("DATA_ENC_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).");
  return k;
}

/** AES-256-GCM for small secrets kept in the database (staff TOTP secrets). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(packed: string) {
  const [iv, tag, body] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

/** Signs a small JSON value so it can sit in a cookie without being changed by the visitor. */
export function seal(value: unknown, ttlSeconds: number, purpose: string) {
  // the purpose is inside the signed data, so a cookie made for one job can't be used for another
  const body = Buffer.from(JSON.stringify({ v: value, exp: Date.now() + ttlSeconds * 1000, p: purpose })).toString("base64url");
  return `${body}.${hmac(env.sessionSecret, body)}`;
}

export function unseal<T>(sealed: string | undefined, purpose: string): T | null {
  if (!sealed) return null;
  const [body, sig] = sealed.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(env.sessionSecret, body))) return null;
  try {
    const { v, exp, p } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { v: T; exp: number; p: string };
    return Date.now() < exp && p === purpose ? v : null;
  } catch {
    return null;
  }
}
