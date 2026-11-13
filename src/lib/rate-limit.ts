/**
 * A small in-memory rate limit for the site's API routes (per visitor IP, per route).
 * It stops one visitor or bot from flooding the AI, photo and form endpoints.
 * Each server instance keeps its own counts; that is enough to blunt abuse without a database.
 */
const hits = new Map<string, { n: number; reset: number }>();

export function clientIp(req: Request) {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

/** True when this visitor is still under `max` requests per `windowMs` for `name`. */
export function allow(req: Request, name: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const key = `${name}:${clientIp(req)}`;
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  cur.n++;
  return cur.n <= max;
}

export const tooMany = () => Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
