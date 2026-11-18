import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Member list with search and paging. Search text is a parameter, never joined into SQL. */
export const GET = api({ auth: "staff", limit: ["staff", 120] }, async (req, s) => {
  const u = new URL(req.url);
  const search = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const page = Math.max(0, Math.min(10_000, Number(u.searchParams.get("page") || 0)));
  const rows = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", (q) =>
    q(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.marketing, u.club_code, u.created_at, u.last_seen_at,
              (SELECT count(*) FROM scans sc WHERE sc.user_id = u.id) AS scans,
              (SELECT coalesce(sum(delta), 0) FROM points_ledger p WHERE p.user_id = u.id) AS points
         FROM users u
        WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%' OR u.club_code = upper($1))
        ORDER BY u.created_at DESC
        LIMIT 50 OFFSET $2`,
      [search.replace(/[%_\\]/g, (c) => `\\${c}`), page * 50],
    ),
  );
  return json({ rows, page });
});
