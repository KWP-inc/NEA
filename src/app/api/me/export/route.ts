import { api } from "@/lib/server/route";
import { asUser } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** "Download my data": everything we hold about the member, as one JSON file. */
export const GET = api({ auth: "user", limit: ["me-export", 5] }, async (_req, s) => {
  const id = s!.user.id;
  const data = await asUser(id, async (q) => ({
    account: (await q("SELECT email, name, birth_ym, role, status, marketing, club_code, created_at FROM users WHERE id = $1", [id]))[0],
    signInMethods: await q("SELECT provider, created_at FROM auth_identities WHERE user_id = $1", [id]),
    consents: await q("SELECT kind, version, given, created_at FROM consents WHERE user_id = $1 ORDER BY created_at", [id]),
    scans: await q("SELECT score, bpm, metrics, source, taken_at FROM scans WHERE user_id = $1 ORDER BY taken_at", [id]),
    myGlow: await q("SELECT kind, data, updated_at FROM glow_docs WHERE user_id = $1", [id]),
    points: await q("SELECT kind, delta, label, created_at FROM points_ledger WHERE user_id = $1 ORDER BY created_at", [id]),
    rewards: await q("SELECT name, pts, code, created_at, used_at FROM redemptions WHERE user_id = $1 ORDER BY created_at", [id]),
    exportedAt: new Date().toISOString(),
  }));
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-nea-data.json"', "Cache-Control": "no-store" },
  });
});
