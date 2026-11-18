import "server-only";
import { getSession, requireAdmin, requireStaff, requireUser, type Session } from "./auth";
import { failed, json, notFound, sameOrigin, tooMany, unauthorized } from "./http";
import { limit } from "./rate-limit";

/**
 * Wraps every API handler with the same checks, in the same order:
 *   1. CSRF: changing requests must come from our own site (Origin check).
 *   2. Rate limit per visitor.
 *   3. Who is asking: public / signed-in member / staff with MFA / admin. Checked on the server, every time.
 *   4. Errors become a short generic answer; details go to the server log.
 * Staff and admin routes answer 404 (not 403) to anyone else, so outsiders can't tell they exist.
 */
type Guard = "public" | "session" | "user" | "staff" | "admin";
type Opts = { auth: Guard; limit?: [name: string, max: number, windowMs?: number]; csrf?: boolean };
type Handler<C> = (req: Request, s: Session | null, ctx: C) => Promise<Response>;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function api<C = unknown>(opts: Opts, fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      if (MUTATING.has(req.method) && opts.csrf !== false && !sameOrigin(req)) return json({ error: "Bad origin." }, 403);
      if (opts.limit && !(await limit(req, opts.limit[0], opts.limit[1], opts.limit[2]))) return tooMany();
      let s: Session | null = null;
      if (opts.auth === "session") s = await getSession();
      if (opts.auth === "user") {
        s = await requireUser();
        if (!s) return unauthorized();
      }
      if (opts.auth === "staff") {
        s = await requireStaff();
        if (!s) return notFound();
      }
      if (opts.auth === "admin") {
        s = await requireAdmin();
        if (!s) return notFound();
      }
      return await fn(req, s, ctx);
    } catch (e) {
      return failed(new URL(req.url).pathname, e);
    }
  };
}
