import "server-only";
import { cookies } from "next/headers";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { env } from "./env";
import { seal, token, unseal } from "./crypto";
import { safeFetch } from "./http";

/**
 * "Continue with Google / Apple". Standard OpenID Connect with every check:
 * state (stops login CSRF), nonce (stops token replay), PKCE for Google, and the ID token's signature,
 * issuer, audience and expiry checked against the provider's published keys.
 */
type Provider = "google" | "apple";
type Pending = { p: Provider; state: string; nonce: string; verifier: string; next: string };

const COOKIE = (p: Provider) => (env.isProd ? `__Host-nea_oauth_${p}` : `nea_oauth_${p}`);
const redirectUri = (p: Provider) => `${env.siteUrl}/api/auth/${p}/callback`;
const b64url = (b: Buffer) => b.toString("base64url");

/** Only local paths, so a link can't bounce people to another site after sign-in. */
export function safeNext(next: string | null | undefined) {
  return next && /^\/(?!\/)[\w\-/?=&.#%]*$/.test(next) && next.length < 200 ? next : "/account";
}

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function startUrl(p: Provider, next: string) {
  const pending: Pending = { p, state: token(24), nonce: token(24), verifier: token(48), next: safeNext(next) };
  // Apple posts back from its own site, so this one short-lived cookie must be SameSite=None (still HttpOnly + Secure).
  (await cookies()).set(COOKIE(p), seal(pending, 10 * 60, `oauth-${p}`), {
    httpOnly: true,
    secure: env.isProd || p === "apple",
    sameSite: p === "apple" ? "none" : "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  if (p === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: env.google.id,
      redirect_uri: redirectUri(p),
      response_type: "code",
      scope: "openid email profile",
      state: pending.state,
      nonce: pending.nonce,
      code_challenge: b64url(createHash("sha256").update(pending.verifier).digest()),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return u.toString();
  }
  const u = new URL("https://appleid.apple.com/auth/authorize");
  u.search = new URLSearchParams({
    client_id: env.apple.id,
    redirect_uri: redirectUri(p),
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state: pending.state,
    nonce: pending.nonce,
  }).toString();
  return u.toString();
}

async function takePending(p: Provider, state: string | null): Promise<Pending | null> {
  const jar = await cookies();
  const pending = unseal<Pending>(jar.get(COOKIE(p))?.value, `oauth-${p}`);
  jar.set(COOKIE(p), "", { httpOnly: true, secure: env.isProd || p === "apple", sameSite: p === "apple" ? "none" : "lax", path: "/", maxAge: 0 });
  return pending && pending.p === p && state && pending.state === state ? pending : null;
}

export type OAuthResult = { email: string; sub: string; name?: string; next: string };

export async function finishGoogle(code: string | null, state: string | null): Promise<OAuthResult | null> {
  const pending = await takePending("google", state);
  if (!pending || !code || code.length > 2000) return null;
  const res = await safeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.id,
      client_secret: env.google.secret,
      redirect_uri: redirectUri("google"),
      grant_type: "authorization_code",
      code_verifier: pending.verifier,
    }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  const { payload } = await jwtVerify(id_token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env.google.id });
  if (payload.nonce !== pending.nonce || payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub) return null;
  return { email: payload.email.toLowerCase(), sub: payload.sub, name: typeof payload.name === "string" ? payload.name : undefined, next: pending.next };
}

async function appleClientSecret() {
  const key = await importPKCS8(env.apple.key, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.apple.keyId })
    .setIssuer(env.apple.team)
    .setSubject(env.apple.id)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

export async function finishApple(form: FormData): Promise<OAuthResult | null> {
  const state = form.get("state");
  const code = form.get("code");
  const pending = await takePending("apple", typeof state === "string" ? state : null);
  if (!pending || typeof code !== "string" || code.length > 2000) return null;
  const res = await safeFetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.apple.id, client_secret: await appleClientSecret(), redirect_uri: redirectUri("apple"), grant_type: "authorization_code" }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  const { payload } = await jwtVerify(id_token, appleKeys, { issuer: "https://appleid.apple.com", audience: env.apple.id });
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (payload.nonce !== pending.nonce || !verified || typeof payload.email !== "string" || !payload.sub) return null;
  // Apple sends the name only the first time, as JSON in the form.
  let name: string | undefined;
  try {
    const u = JSON.parse(String(form.get("user") || "{}")) as { name?: { firstName?: string; lastName?: string } };
    name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ").slice(0, 80) || undefined;
  } catch {
    /* no name */
  }
  return { email: payload.email.toLowerCase(), sub: payload.sub, name, next: pending.next };
}
