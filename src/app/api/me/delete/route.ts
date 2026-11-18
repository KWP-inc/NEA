import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { asSystem, asUser } from "@/lib/server/db";
import { destroySession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const schema = z.object({ confirm: z.literal("DELETE") });

/**
 * Deletes the account and everything in it (scans, plans, points, sessions) in one go.
 * Website activity rows are kept only without the person's id (anonymous counts).
 */
export const POST = api({ auth: "user", limit: ["me-delete", 5] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b) return bad('Type DELETE to confirm.');
  if (s!.user.role !== "member") return bad("Staff accounts are removed by an admin.");
  await asSystem((q) => q("UPDATE activity_events SET user_id = NULL WHERE user_id = $1", [s!.user.id]));
  await asUser(s!.user.id, (q) => q("DELETE FROM users WHERE id = $1", [s!.user.id]));
  await destroySession();
  return json({ ok: true });
});
