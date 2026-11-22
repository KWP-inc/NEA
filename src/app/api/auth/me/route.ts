import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { accountsMissing, hasApple, hasDb, hasGoogle } from "@/lib/server/env";
import { pool } from "@/lib/server/db";

// is the database actually answering? (checked at most every 30 seconds)
let dbOk = { at: 0, ok: false };
async function dbAnswers() {
  if (!hasDb()) return false;
  if (Date.now() - dbOk.at < 30_000) return dbOk.ok;
  let ok = false;
  try {
    await Promise.race([pool().query("SELECT 1"), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 2000))]);
    ok = true;
  } catch {}
  dbOk = { at: Date.now(), ok };
  return ok;
}

export const dynamic = "force-dynamic";

/** Who is signed in (or null), and which sign-in buttons to show. Never returns secrets. */
export const GET = api({ auth: "session" }, async (req, s) => {
  const missing = accountsMissing();
  if (hasDb() && !(await dbAnswers())) missing.push("PostgreSQL is not answering: start the database (check DATABASE_URL)");
  // which settings are missing is shown only on your own computer (localhost), never on the public site
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.get("host") ?? "");
  return json({
    user: s ? { name: s.user.name, email: s.user.email, role: s.user.role, status: s.user.status, marketing: s.user.marketing, clubCode: s.user.clubCode, mfaOk: s.mfaOk } : null,
    providers: { google: hasGoogle(), apple: hasApple() },
    // false on a site where the database or email isn't set up yet (for example a preview copy)
    accounts: missing.length === 0,
    ...(local && missing.length ? { missing } : {}),
  });
});
