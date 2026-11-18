import "server-only";
import type { Q } from "./db";

/** Every staff change is written to the insert-only audit log, inside the same transaction as the change. */
export async function audit(q: Q, staffId: string, action: string, target: string | null, detail: Record<string, unknown>, ip: string) {
  await q("INSERT INTO audit_log (staff_id, action, target, detail, ip) VALUES ($1, $2, $3, $4, $5)", [staffId, action, target, JSON.stringify(detail), ip]);
}
