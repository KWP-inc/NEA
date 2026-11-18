#!/usr/bin/env node
/**
 * Applies every db/migrations/*.sql file once, in name order, as the database OWNER.
 *   DATABASE_OWNER_URL=postgres://owner:…@host:5432/nea npm run db:migrate
 * Optional: NEA_APP_PASSWORD sets the password of the `nea_app` role the website uses.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error("Set DATABASE_OWNER_URL (the owner connection, not the website one).");
  process.exit(1);
}
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    process.stdout.write(`applying ${f} … `);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await client.query("COMMIT");
      console.log("ok");
    } catch (e) {
      await client.query("ROLLBACK");
      console.log("FAILED");
      throw e;
    }
  }
  if (process.env.NEA_APP_PASSWORD) {
    const { rows } = await client.query("SELECT format('ALTER ROLE nea_app PASSWORD %L', $1::text) AS q", [process.env.NEA_APP_PASSWORD]);
    await client.query(rows[0].q);
    console.log("nea_app password set");
  }
  console.log("database is up to date");
} finally {
  await client.end();
}
