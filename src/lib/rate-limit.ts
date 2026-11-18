import "server-only";
import { sameOrigin, tooMany } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";

/**
 * Older routes (ask, lens, product, club) call this at the top:
 *   const g = await guard(req, "ask", 20); if (g) return g;
 * It blocks requests to change data that come from other sites (CSRF) and applies the shared rate limit.
 */
export async function guard(req: Request, name: string, max: number, windowMs = 60_000): Promise<Response | null> {
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return Response.json({ error: "Bad origin." }, { status: 403 });
  if (!(await limit(req, name, max, windowMs))) return tooMany();
  return null;
}
