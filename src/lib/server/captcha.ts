import "server-only";
import { createChallenge, verifySolution } from "altcha-lib";
import { env } from "./env";
import { sha256 } from "./crypto";
import { hit } from "./rate-limit";

/**
 * Captcha without a third party (ALTCHA, open source). The server hands out a signed puzzle; the browser
 * spends a moment of work solving it; the server checks the answer and that it was used only once.
 * Bots have to pay that work for every single try, and no tracking service is involved.
 */
export async function newChallenge() {
  return createChallenge({ hmacKey: env.altchaKey, maxNumber: 80_000, expires: new Date(Date.now() + 10 * 60_000) });
}

export async function checkCaptcha(payload: unknown): Promise<boolean> {
  if (typeof payload !== "string" || payload.length > 2000) return false;
  try {
    const ok = await verifySolution(payload, env.altchaKey, true);
    if (!ok) return false;
    // one use only: the same solved puzzle can't be replayed
    return await hit(`captcha:${sha256(payload)}`, 1, 15 * 60_000);
  } catch {
    return false;
  }
}
