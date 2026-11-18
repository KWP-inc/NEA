import "server-only";
import { hmac, safeEqual } from "./crypto";

/**
 * Checks a signed webhook (ours to a CRM, or a provider's to us). The sender signs `${timestamp}.${body}`
 * with a shared secret; we refuse anything unsigned, wrongly signed, or older than 5 minutes (replays).
 * Receivers of NEA's lead webhook can copy this exact check.
 */
export function verifyWebhook(secret: string, rawBody: string, timestamp: string | null, signature: string | null, maxAgeSec = 300) {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > maxAgeSec) return false;
  return safeEqual(signature, `sha256=${hmac(secret, `${timestamp}.${rawBody}`)}`);
}
