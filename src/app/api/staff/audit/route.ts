import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Admin only: who did what, when. The log can't be changed or deleted by the website. */
export const GET = api({ auth: "admin", limit: ["staff", 60] }, async (req, s) => {
  const page = Math.max(0, Math.min(10_000, Number(new URL(req.url).searchParams.get("page") || 0)));
  const rows = await asStaff(s!.user.id, "admin", (q) =>
    q("SELECT a.id, a.action, a.target, a.detail, a.ip, a.created_at, u.email AS staff FROM audit_log a LEFT JOIN users u ON u.id = a.staff_id ORDER BY a.created_at DESC LIMIT 100 OFFSET $1", [page * 100]),
  );
  return json({ rows, page });
});
