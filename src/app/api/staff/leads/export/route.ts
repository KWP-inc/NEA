import { api } from "@/lib/server/route";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { clientIp } from "@/lib/server/http";
import { csv } from "@/lib/server/csv";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "staff", limit: ["staff-export", 5] }, async (req, s) => {
  const rows = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const r = await q<Record<string, unknown>>("SELECT kind, name, email, phone, message, meta, created_at FROM leads ORDER BY created_at DESC LIMIT 100000");
    await audit(q, s!.user.id, "leads.export", null, { count: r.length }, clientIp(req));
    return r;
  });
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="nea-leads.csv"', "Cache-Control": "no-store" } });
});
