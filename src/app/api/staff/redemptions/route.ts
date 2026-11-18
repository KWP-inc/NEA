import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, clientIp, json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Front desk: look up a reward code and mark it used. */
export const GET = api({ auth: "staff", limit: ["staff", 120] }, async (req, s) => {
  const code = (new URL(req.url).searchParams.get("code") || "").trim().toUpperCase().slice(0, 20);
  const rows = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", (q) =>
    q(
      `SELECT r.id, r.name, r.pts, r.code, r.created_at, r.used_at, u.name AS member, u.email
         FROM redemptions r JOIN users u ON u.id = r.user_id
        WHERE ($1 = '' AND r.used_at IS NULL) OR r.code = $1
        ORDER BY r.created_at DESC LIMIT 50`,
      [code],
    ),
  );
  return json({ rows });
});

const schema = z.object({ id: z.string().uuid() });

export const POST = api({ auth: "staff", limit: ["staff-write", 60] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b) return bad();
  const n = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const r = await q("UPDATE redemptions SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id", [b.id]);
    if (r.length) await audit(q, s!.user.id, "reward.used", b.id, {}, clientIp(req));
    return r.length;
  });
  return n ? json({ ok: true }) : bad("That reward was already used.");
});
