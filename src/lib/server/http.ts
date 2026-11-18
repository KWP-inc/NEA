import "server-only";
import { z } from "zod";
import { env } from "./env";

/** Plain JSON answers. Errors are short and generic; details go to the server log only. */
export const json = (data: unknown, init?: number | ResponseInit) =>
  Response.json(data, typeof init === "number" ? { status: init, headers: { "Cache-Control": "no-store" } } : { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers || {}) } });
export const bad = (msg = "Please check the form and try again.") => json({ error: msg }, 400);
export const unauthorized = () => json({ error: "Please sign in first." }, 401);
export const notFound = () => json({ error: "Not found." }, 404);
export const tooMany = () => json({ error: "Too many tries. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
export const failed = (where: string, e: unknown) => {
  console.error(JSON.stringify({ level: "error", where, err: e instanceof Error ? e.message : String(e) }));
  return json({ error: "Something went wrong. Please try again." }, 500);
};

/**
 * The visitor's IP, for rate limits and logs. Behind Nginx, X-Real-IP is set by Nginx itself
 * (proxy_set_header X-Real-IP $remote_addr), so a visitor can't fake it. Otherwise the LAST
 * X-Forwarded-For hop is used (the one our own proxy added), never the first (which anyone can type).
 */
export function clientIp(req: Request) {
  const h = req.headers;
  const real = h.get("x-real-ip");
  const hops = (h.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (real || hops[hops.length - 1] || "unknown").slice(0, 64);
}

/**
 * CSRF guard for anything that changes data. Browsers always send Origin on POST/PUT/PATCH/DELETE,
 * and another site cannot fake it. Same-site cookies (SameSite=Lax) are the second lock.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    return o.origin === new URL(env.siteUrl).origin;
  } catch {
    return false;
  }
}

const MAX_BODY = 64 * 1024;

/**
 * Reads a request body but stops as soon as it passes `maxBytes`, even when the sender gives no
 * Content-Length (chunked upload). Returns null when it's too big or unreadable.
 */
export async function readCapped(req: Request, maxBytes: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") || 0) > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Reads and checks a JSON body against a schema. Never trust the browser: unknown keys are dropped,
 * types and lengths are enforced, and big bodies are refused.
 */
export async function body<S extends z.ZodTypeAny>(req: Request, schema: S, maxBytes = MAX_BODY): Promise<z.infer<S> | null> {
  const text = await readCapped(req, maxBytes);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Text a person typed: trimmed, control characters removed, length capped. React escapes it on output. */
export const cleanText = (max: number, multiline = false) =>
  z
    .string()
    .transform((s) => (multiline ? s : s.replace(/[\r\n]+/g, " ")).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email();

/**
 * Server-side fetch that only talks to known hosts (stops SSRF) and always times out.
 * A visitor can never make the server fetch a URL they typed.
 */
const ALLOWED_HOSTS = new Set([
  "generativelanguage.googleapis.com",
  "chat.xevyo.com",
  "world.openbeautyfacts.org",
  "api.open-meteo.com",
  "air-quality-api.open-meteo.com",
  "graph.instagram.com",
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "appleid.apple.com",
]);

export function allowHost(host: string) {
  ALLOWED_HOSTS.add(host.toLowerCase());
}

export async function safeFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname.toLowerCase())) throw new Error(`blocked fetch to ${u.hostname}`);
  const { timeoutMs = 15_000, ...rest } = init;
  return fetch(u, { ...rest, redirect: "error", signal: rest.signal ?? AbortSignal.timeout(timeoutMs) });
}
