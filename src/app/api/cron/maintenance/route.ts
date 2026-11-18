import { pool } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { safeEqual } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";

/**
 * Daily housekeeping (partitions, daily totals, old data, expired codes and sessions).
 * DevOps runs it once a day:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://neaprecisionskin.com/api/cron/maintenance
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return new Response("Not found", { status: 404 });
  const { rows } = await pool().query("SELECT nea_maintenance() AS r");
  return Response.json(rows[0].r, { headers: { "Cache-Control": "no-store" } });
}
