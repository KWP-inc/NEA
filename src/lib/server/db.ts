import "server-only";
import { Pool, type PoolClient } from "pg";
import { env } from "./env";

/**
 * One connection pool per server process. The website connects as `nea_app`, which cannot bypass
 * Row Level Security. Every query runs inside a transaction that first sets who is asking:
 *   app.user_id: the signed-in member (from the session cookie, never from the browser)
 *   app.role:    member | staff | admin | system (system = sign-in flows and jobs run by our own code)
 * Every query uses $1, $2 … parameters. Never build SQL by joining strings.
 */
export type Role = "anon" | "member" | "staff" | "admin" | "system";
export type Q = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

const g = globalThis as unknown as { __neaPool?: Pool };

export function pool() {
  if (!g.__neaPool) {
    g.__neaPool = new Pool({
      connectionString: env.databaseUrl,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      application_name: "nea-web",
    });
    g.__neaPool.on("error", (e) => console.error(JSON.stringify({ level: "error", msg: "db pool error", err: e.message })));
  }
  return g.__neaPool;
}

const SLOW_MS = Number(process.env.DB_SLOW_MS || 50);

async function run<T>(role: Role, userId: string | null, fn: (q: Q, c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    // set_config(..., true) = SET LOCAL: it ends with the transaction, so a pooled connection never keeps it.
    await c.query("SELECT set_config('app.role', $1, true), set_config('app.user_id', $2, true)", [role, userId ?? ""]);
    const q: Q = async (text, params = []) => {
      const t = Date.now();
      const r = await c.query(text, params as unknown[]);
      const ms = Date.now() - t;
      if (ms > SLOW_MS) console.warn(JSON.stringify({ level: "warn", msg: "slow query", ms, sql: text.slice(0, 120) }));
      return r.rows as never;
    };
    const out = await fn(q, c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** As a signed-in member: RLS limits every query to their own rows. */
export const asUser = <T>(userId: string, fn: (q: Q) => Promise<T>) => run("member", userId, fn);
/** As staff or admin (after MFA). */
export const asStaff = <T>(staffId: string, role: "staff" | "admin", fn: (q: Q) => Promise<T>) => run(role, staffId, fn);
/** Our own server code (sign-in, jobs). Never reached from browser input without a check first. */
export const asSystem = <T>(fn: (q: Q) => Promise<T>) => run("system", null, fn);
/** Anonymous visitor: can only add leads and activity. */
export const asAnon = <T>(fn: (q: Q) => Promise<T>) => run("anon", null, fn);
