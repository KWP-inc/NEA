import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { asUser } from "@/lib/server/db";
import { addScan, earn, scanSchema } from "@/lib/server/glow";

export const dynamic = "force-dynamic";

/** Saves a face scan to the Skin Diary: numbers only. A photo is never accepted here. */
export const POST = api({ auth: "user", limit: ["me-write", 60] }, async (req, s) => {
  const b = await body(req, scanSchema);
  if (!b) return bad();
  await asUser(s!.user.id, (q) => addScan(q, s!.user.id, b, "live"));
  const pts = await earn(s!.user.id, "scan");
  return json({ ok: true, pts });
});

const del = z.object({ id: z.string().max(40).regex(/^[A-Za-z0-9_-]+$/) });

/** Removes one diary entry. RLS + the user_id match mean a member can only remove their own. */
export const DELETE = api({ auth: "user", limit: ["me-write", 60] }, async (req, s) => {
  const b = await body(req, del);
  if (!b) return bad();
  await asUser(s!.user.id, (q) => q("DELETE FROM scans WHERE user_id = $1 AND (client_ref = $2 OR id::text = $2)", [s!.user.id, b.id]));
  return json({ ok: true });
});
