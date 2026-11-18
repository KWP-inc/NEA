#!/usr/bin/env node
/**
 * Creates the first admin (or makes an existing account admin).
 *   DATABASE_OWNER_URL=postgres://… node scripts/create-admin.mjs owner@neaskincare.com "Arsh"
 * Then: open https://<site>/<ADMIN_PATH>, sign in with the email code, and set up two-step sign-in.
 */
import pg from "pg";

const [email, name = ""] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/create-admin.mjs you@example.com "Your name"');
  process.exit(1);
}
const url = process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error("Set DATABASE_OWNER_URL.");
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT set_config('app.role', 'system', true)");
  const { rows } = await c.query(
    `INSERT INTO users (email, name, role, status) VALUES (lower($1), $2, 'admin', 'active')
     ON CONFLICT ((lower(email))) DO UPDATE SET role = 'admin', status = 'active' RETURNING id`,
    [email, name],
  );
  await c.query("INSERT INTO auth_identities (user_id, provider, provider_sub) VALUES ($1, 'email', lower($2)) ON CONFLICT DO NOTHING", [rows[0].id, email]);
  await c.query("COMMIT");
  console.log(`${email} is now an admin.`);
} finally {
  await c.end();
}
