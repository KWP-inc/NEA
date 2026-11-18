"use client";
/**
 * Solves the site's captcha puzzle in the browser (ALTCHA format): find the number that, added to the salt,
 * gives the server's SHA-256 hash. Takes a fraction of a second for a person, and costs a bot the same for every try.
 * Nothing is sent to any third party.
 */
type Challenge = { algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number; maxNumber?: number };

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function solveCaptcha(): Promise<string> {
  const res = await fetch("/api/auth/captcha", { cache: "no-store" });
  if (!res.ok) throw new Error("Security check is busy. Please try again.");
  const c = (await res.json()) as Challenge;
  const max = c.maxnumber ?? c.maxNumber ?? 100_000;
  const enc = new TextEncoder();
  for (let n = 0; n <= max; n++) {
    if (hex(await crypto.subtle.digest("SHA-256", enc.encode(c.salt + n))) === c.challenge) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    }
  }
  throw new Error("Security check failed. Please try again.");
}
