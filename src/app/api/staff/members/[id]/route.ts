import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, json, notFound } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";

export const dynamic = "force-dynamic";
const id = z.string().uuid();

/** One member: details, scan numbers (never photos), points, rewards and consent history. */
export const GET = api<{ params: Promise<{ id: string }> }>({ auth: "staff", limit: ["staff", 120] }, async (_req, s, ctx) => {
  const p = id.safeParse((await ctx.params).id);
  if (!p.success) return bad();
  const uid = p.data;
  const data = await asStaff(s!.user.id, s!.user.role === "admin" ? "admin" : "staff", async (q) => {
    const [user] = await q("SELECT id, name, email, birth_ym, role, status, marketing, club_code, created_at, last_seen_at FROM users WHERE id = $1", [uid]);
    if (!user) return null;
    return {
      user,
      scans: await q("SELECT score, bpm, metrics, source, taken_at FROM scans WHERE user_id = $1 ORDER BY taken_at DESC LIMIT 60", [uid]),
      points: await q("SELECT kind, delta, label, created_at FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [uid]),
      rewards: await q("SELECT id, name, pts, code, created_at, used_at FROM redemptions WHERE user_id = $1 ORDER BY created_at DESC", [uid]),
      consents: await q("SELECT kind, version, given, created_at FROM consents WHERE user_id = $1 ORDER BY created_at DESC", [uid]),
      signIn: await q("SELECT provider, created_at FROM auth_identities WHERE user_id = $1", [uid]),
    };
  });
  return data ? json(data) : notFound();
});
