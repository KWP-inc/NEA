import { z } from "zod";
import { api } from "@/lib/server/route";
import { body, json } from "@/lib/server/http";
import { asAnon } from "@/lib/server/db";
import { EVENT_NAMES } from "@/lib/analytics-events";

export const dynamic = "force-dynamic";

const id = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/);
const schema = z.object({
  anon: id,
  sid: id,
  ref: z.string().max(300).optional(),
  utm: z.record(z.string().max(100)).optional(),
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        path: z.string().max(200).regex(/^\//),
        props: z.record(z.union([z.string().max(120), z.number(), z.boolean()])).optional(),
        t: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * First-party analytics. Only sent after the visitor allows analytics in the cookie banner.
 * Names come from a fixed list, sizes are capped, and the member's id is taken from their session (never from the browser).
 */
export const POST = api({ auth: "session", limit: ["events", 60] }, async (req, s) => {
  const b = await body(req, schema, 24 * 1024);
  if (!b) return json({ ok: false }, 400);
  const ua = req.headers.get("user-agent") || "";
  const device = /mobi|iphone|android/i.test(ua) ? "phone" : /ipad|tablet/i.test(ua) ? "tablet" : "desktop";
  const now = Date.now();
  const rows = b.events.map((e) => ({
    name: e.name,
    path: e.path,
    props: JSON.stringify(e.props ?? {}),
    // trust the browser clock only within 10 minutes of ours
    at: new Date(Math.abs(now - e.t) < 600_000 ? e.t : now).toISOString(),
  }));
  await asAnon((q) =>
    q(
      `INSERT INTO activity_events (user_id, anon_id, session_id, name, path, props, utm, referrer, device, created_at)
       SELECT $1, $2, $3, n, p, pr::jsonb, $4::jsonb, $5, $6, t::timestamptz
         FROM unnest($7::text[], $8::text[], $9::text[], $10::text[]) AS x(n, p, pr, t)`,
      [
        s?.user.id ?? null,
        b.anon,
        b.sid,
        JSON.stringify(b.utm ?? {}),
        b.ref?.slice(0, 300) ?? null,
        device,
        rows.map((r) => r.name),
        rows.map((r) => r.path),
        rows.map((r) => r.props),
        rows.map((r) => r.at),
      ],
    ),
  );
  return json({ ok: true });
});
