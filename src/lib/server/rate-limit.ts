import "server-only";
import { asSystem } from "./db";
import { hasDb } from "./env";
import { clientIp } from "./http";

/**
 * Shared rate limit. Counts live in Postgres (an UNLOGGED table, very fast), so every app server shares
 * the same numbers. If the database can't be reached, it falls back to a per-server memory counter
 * rather than letting everything through.
 */
const mem = new Map<string, { n: number; reset: number }>();

function memHit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (mem.size > 10_000) for (const [k, v] of mem) if (v.reset < now) mem.delete(k);
  const cur = mem.get(key);
  if (!cur || cur.reset < now) {
    mem.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  return ++cur.n <= max;
}

export async function hit(key: string, max: number, windowMs = 60_000): Promise<boolean> {
  if (!hasDb()) return memHit(key, max, windowMs);
  try {
    const rows = await asSystem((q) =>
      q<{ count: number }>(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
         ON CONFLICT (key) DO UPDATE SET
           count    = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at < now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
         RETURNING count`,
        [key, windowMs],
      ),
    );
    return rows[0].count <= max;
  } catch {
    return memHit(key, max, windowMs);
  }
}

/** Per visitor IP, per route name. */
export const limit = (req: Request, name: string, max: number, windowMs = 60_000) => hit(`${name}:ip:${clientIp(req)}`, max, windowMs);

/** True when `key` is already over `max` in its current window (doesn't count this call). */
export async function over(key: string, max: number): Promise<boolean> {
  if (!hasDb()) {
    const cur = mem.get(key);
    return Boolean(cur && cur.reset > Date.now() && cur.n >= max);
  }
  try {
    const rows = await asSystem((q) => q<{ count: number }>("SELECT count FROM rate_limits WHERE key = $1 AND reset_at > now()", [key]));
    return (rows[0]?.count ?? 0) >= max;
  } catch {
    return false;
  }
}
