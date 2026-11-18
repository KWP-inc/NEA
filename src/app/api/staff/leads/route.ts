import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "staff", limit: ["staff", 120] }, async (req, s) => {
  const u = new URL(req.url);
  const page = Math.max(0, Math.min(10_000, Number(u.searchParams.get("page") || 0)));
  const kind = (u.searchParams.get("kind") || "").slice(0, 20);
  const rows = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", (q) =>
    q("SELECT id, kind, name, email, phone, message, meta, created_at FROM leads WHERE ($1 = '' OR kind = $1) ORDER BY created_at DESC LIMIT 50 OFFSET $2", [kind, page * 50]),
  );
  return json({ rows, page });
});
