#!/usr/bin/env node
/** Daily housekeeping (run by cron once a day). Same as POST /api/cron/maintenance.
 *   DATABASE_URL=… node scripts/db-maintain.mjs */
import "./load-env.mjs";
import pg from "pg";
const url = process.env.DATABASE_URL || process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
const { rows } = await c.query("SELECT nea_maintenance() AS r");
console.log(JSON.stringify(rows[0].r));
await c.end();
