import "server-only";
import { z } from "zod";
import { asSystem, asUser, type Q } from "./db";
import { EARN, REWARDS, type EarnKey } from "@/content/club";
import { token } from "./crypto";

/**
 * Member data for the My Glow tools. Points are decided here on the server (the browser only asks),
 * so nobody can give themselves points by editing their phone's storage.
 */
const TZ = "America/Edmonton";

/** Glow Club clinic codes from the server setting CLUB_CODES="GLOW50=50=Clinic visit,FRIEND100=100=Friend booked". */
export function clubCodes() {
  const out = new Map<string, { pts: number; label: string }>();
  for (const part of (process.env.CLUB_CODES || "").split(",")) {
    const [code, pts, label] = part.split("=").map((s) => s.trim());
    const n = Number(pts);
    if (code && Number.isFinite(n) && n > 0 && n <= 1000) out.set(code.toUpperCase(), { pts: Math.round(n), label: label || "Clinic visit" });
  }
  return out;
}

/* ───────── Schemas (never trust the browser) ───────── */

export const metricSchema = z.object({
  key: z.string().max(24).regex(/^[a-z_]+$/),
  label: z.string().max(40),
  value: z.string().max(40),
  level: z.number().min(0).max(100),
});
export const scanSchema = z.object({
  id: z.string().max(40).regex(/^[A-Za-z0-9_-]+$/),
  at: z.string().datetime().optional(),
  score: z.number().int().min(0).max(100),
  bpm: z.number().int().min(30).max(220).optional(),
  metrics: z.array(metricSchema).max(12),
});
export type ScanIn = z.infer<typeof scanSchema>;

const MAX_DOC = 32 * 1024;
const docOk = (v: unknown) => JSON.stringify(v ?? null).length <= MAX_DOC;
export const docSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("routine"), value: z.array(z.record(z.unknown())).max(60).refine(docOk, "too big") }),
  z.object({ kind: z.literal("event"), value: z.record(z.unknown()).refine(docOk, "too big") }),
  z.object({ kind: z.literal("plan"), value: z.record(z.unknown()).refine(docOk, "too big") }),
]);

/* ───────── Reading everything for the browser ───────── */

export async function glowState(userId: string) {
  return asUser(userId, async (q) => {
    const [me] = await q<{ club_code: string }>("SELECT club_code FROM users WHERE id = $1", [userId]);
    const scans = await q<{ id: string; client_ref: string | null; score: number; bpm: number | null; metrics: unknown; taken_at: string }>(
      "SELECT id, client_ref, score, bpm, metrics, taken_at FROM scans WHERE user_id = $1 ORDER BY taken_at ASC LIMIT 400",
      [userId],
    );
    const docs = await q<{ kind: string; data: unknown }>("SELECT kind, data FROM glow_docs WHERE user_id = $1", [userId]);
    const ledger = await q<{ id: string; kind: string; delta: number; label: string; code: string | null; created_at: string }>(
      "SELECT id::text, kind, delta, label, code, created_at FROM points_ledger WHERE user_id = $1 AND kind <> 'redeem' ORDER BY created_at ASC LIMIT 1000",
      [userId],
    );
    const redeemed = await q<{ id: string; reward: string; name: string; pts: number; code: string; created_at: string }>(
      "SELECT id, reward, name, pts, code, created_at FROM redemptions WHERE user_id = $1 ORDER BY created_at ASC",
      [userId],
    );
    return {
      diary: scans.map((s) => ({ id: s.client_ref || s.id, at: new Date(s.taken_at).toISOString(), score: s.score, bpm: s.bpm ?? undefined, metrics: s.metrics })),
      routine: docs.find((d) => d.kind === "routine")?.data ?? null,
      event: docs.find((d) => d.kind === "event")?.data ?? null,
      plan: docs.find((d) => d.kind === "plan")?.data ?? null,
      club: {
        me: me?.club_code ?? "",
        ledger: ledger.map((l) => ({ id: `s${l.id}`, at: new Date(l.created_at).toISOString(), kind: l.kind, pts: l.delta, label: l.label, code: l.code ?? undefined })),
        redeemed: redeemed.map((r) => ({ id: r.id, at: new Date(r.created_at).toISOString(), reward: r.reward, name: r.name, pts: r.pts, code: r.code })),
      },
    };
  });
}

/* ───────── Writing ───────── */

export async function addScan(q: Q, userId: string, s: ScanIn, source: "live" | "lens" | "import" = "live") {
  await q(
    `INSERT INTO scans (user_id, client_ref, source, score, bpm, metrics, taken_at) VALUES ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()))
     ON CONFLICT (user_id, client_ref) WHERE client_ref IS NOT NULL DO NOTHING`,
    [userId, s.id, source, s.score, s.bpm ?? null, JSON.stringify(s.metrics), s.at ?? null],
  );
}

/** Gives points for an action if its rule allows it. Returns the points given (0 if already counted). */
export async function earn(userId: string, kind: EarnKey, code?: string): Promise<number> {
  // runs as server code: the database only lets trusted code add points (members can't insert ledger rows)
  return asSystem(async (q) => {
    // one at a time per member, so two quick taps can't double-count
    await q("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    let pts = EARN[kind].pts;
    let label: string = EARN[kind].label;
    if (kind === "code") {
      const hit = code ? clubCodes().get(code.toUpperCase()) : undefined;
      if (!hit) return 0;
      pts = hit.pts;
      label = hit.label;
      // each clinic code counts once per member, and at most one clinic code a week (codes can't be farmed)
      const dup = await q("SELECT 1 FROM points_ledger WHERE user_id = $1 AND kind = 'code' AND (code = $2 OR created_at > now() - interval '7 days') LIMIT 1", [userId, code!.toUpperCase()]);
      if (dup.length) return 0;
    } else if (EARN[kind].limit === "once") {
      if ((await q("SELECT 1 FROM points_ledger WHERE user_id = $1 AND kind = $2 LIMIT 1", [userId, kind])).length) return 0;
    } else if (EARN[kind].limit === "day") {
      const dup = await q("SELECT 1 FROM points_ledger WHERE user_id = $1 AND kind = $2 AND (created_at AT TIME ZONE $3)::date = (now() AT TIME ZONE $3)::date LIMIT 1", [userId, kind, TZ]);
      if (dup.length) return 0;
    }
    if (pts <= 0) return 0;
    await q("INSERT INTO points_ledger (user_id, kind, delta, label, code) VALUES ($1, $2, $3, $4, $5)", [userId, kind, pts, label, kind === "code" ? code!.toUpperCase() : null]);
    return pts;
  });
}

export async function balanceOf(q: Q, userId: string) {
  const [r] = await q<{ b: string }>("SELECT coalesce(sum(delta), 0) AS b FROM points_ledger WHERE user_id = $1", [userId]);
  return Number(r.b);
}

export async function redeem(userId: string, rewardId: string) {
  const reward = REWARDS.find((r) => r.id === rewardId);
  if (!reward) return null;
  return asSystem(async (q) => {
    await q("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    if ((await balanceOf(q, userId)) < reward.pts) return null;
    const [me] = await q<{ club_code: string }>("SELECT club_code FROM users WHERE id = $1", [userId]);
    const code = `${me.club_code}-${token(3).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4).padEnd(4, "X")}`;
    const [r] = await q<{ id: string; created_at: string }>("INSERT INTO redemptions (user_id, reward, name, pts, code) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at", [
      userId,
      reward.id,
      reward.name,
      reward.pts,
      code,
    ]);
    await q("INSERT INTO points_ledger (user_id, kind, delta, label) VALUES ($1, 'redeem', $2, $3)", [userId, -reward.pts, reward.name]);
    return { id: r.id, at: new Date(r.created_at).toISOString(), reward: reward.id, name: reward.name, pts: reward.pts, code };
  });
}

/** First sign-in: moves what was saved on the phone into the account, once. Imported points are capped. */
export const IMPORT_POINTS_CAP = 100;
export const importSchema = z.object({
  diary: z.array(scanSchema).max(150).default([]),
  routine: z.array(z.record(z.unknown())).max(60).refine(docOk).optional(),
  event: z.record(z.unknown()).refine(docOk).optional(),
  plan: z.record(z.unknown()).refine(docOk).optional(),
  points: z.number().int().min(0).max(100_000).default(0),
});

export async function importDevice(userId: string, data: z.infer<typeof importSchema>) {
  return asSystem(async (q) => {
    await q("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const [u] = await q<{ imported_at: string | null }>("SELECT imported_at FROM users WHERE id = $1", [userId]);
    if (u?.imported_at) return false;
    for (const s of data.diary) await addScan(q, userId, s, "import");
    for (const kind of ["routine", "event", "plan"] as const) {
      const v = data[kind];
      if (v) await q("INSERT INTO glow_docs (user_id, kind, data) VALUES ($1, $2, $3) ON CONFLICT (user_id, kind) DO NOTHING", [userId, kind, JSON.stringify(v)]);
    }
    const pts = Math.min(IMPORT_POINTS_CAP, data.points);
    if (pts > 0) await q("INSERT INTO points_ledger (user_id, kind, delta, label) VALUES ($1, 'import', $2, 'Points from this phone')", [userId, pts]);
    await q("UPDATE users SET imported_at = now() WHERE id = $1", [userId]);
    return true;
  });
}
