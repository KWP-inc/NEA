import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { asUser } from "@/lib/server/db";
import { docSchema, glowState } from "@/lib/server/glow";

export const dynamic = "force-dynamic";

/** Everything the My Glow tools need for the signed-in member. */
export const GET = api({ auth: "user", limit: ["me", 120] }, async (_req, s) => json(await glowState(s!.user.id)));

/** Saves the routine, event countdown or injectables plan (one document each, size-checked). */
export const PUT = api({ auth: "user", limit: ["me-write", 60] }, async (req, s) => {
  const b = await body(req, docSchema, 40 * 1024);
  if (!b) return bad();
  await asUser(s!.user.id, (q) =>
    q(
      `INSERT INTO glow_docs (user_id, kind, data, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, kind) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [s!.user.id, b.kind, JSON.stringify(b.value)],
    ),
  );
  return json({ ok: true });
});
