import { api } from "@/lib/server/route";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { clientIp } from "@/lib/server/http";
import { csv } from "@/lib/server/csv";

export const dynamic = "force-dynamic";

/** CSV of members (who agreed to marketing is a column, so staff can filter it). Logged in the audit log. */
export const GET = api({ auth: "staff", limit: ["staff-export", 5] }, async (req, s) => {
  const rows = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const r = await q<Record<string, unknown>>(
      `SELECT u.name, u.email, u.status, u.marketing, u.club_code, u.created_at,
              (SELECT count(*) FROM scans sc WHERE sc.user_id = u.id) AS scans,
              (SELECT coalesce(sum(delta), 0) FROM points_ledger p WHERE p.user_id = u.id) AS points
         FROM users u WHERE u.role = 'member' ORDER BY u.created_at DESC LIMIT 100000`,
    );
    await audit(q, s!.user.id, "members.export", null, { count: r.length }, clientIp(req));
    return r;
  });
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="nea-members.csv"', "Cache-Control": "no-store" } });
});
