import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, cleanText, clientIp, json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";
const schema = z.object({ userId: z.string().uuid(), delta: z.number().int().min(-2000).max(2000).refine((n) => n !== 0), reason: cleanText(120).pipe(z.string().min(3)) });

/** Give or take Glow Club points, with a reason. Added to the ledger (never edited) and the audit log. */
export const POST = api({ auth: "staff", limit: ["staff-write", 60] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b) return bad("Pick a member, a number of points (not 0) and a reason.");
  if (b.userId === s!.user.id) return bad("You can't change your own points.");
  const ok = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const [u] = await q("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", [b.userId]);
    if (!u) return false;
    await q("INSERT INTO points_ledger (user_id, kind, delta, label, by_staff_id) VALUES ($1, 'staff', $2, $3, $4)", [b.userId, b.delta, b.reason, s!.user.id]);
    await audit(q, s!.user.id, "points.adjust", b.userId, { delta: b.delta, reason: b.reason }, clientIp(req));
    return true;
  });
  return ok ? json({ ok: true }) : bad("That member wasn't found.");
});
