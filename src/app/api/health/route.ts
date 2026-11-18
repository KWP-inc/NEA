import { pool } from "@/lib/server/db";
import { hasDb } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/** Uptime check for DevOps: 200 when the app and database answer, 503 otherwise. No details leak. */
export async function GET() {
  let db = "skipped";
  if (hasDb()) {
    try {
      await pool().query("SELECT 1");
      db = "ok";
    } catch {
      db = "down";
    }
  }
  return Response.json({ ok: db !== "down", db }, { status: db === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
