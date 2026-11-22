import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { accountsReady, hasApple, hasGoogle } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/** Who is signed in (or null), and which sign-in buttons to show. Never returns secrets. */
export const GET = api({ auth: "session" }, async (_req, s) =>
  json({
    user: s ? { name: s.user.name, email: s.user.email, role: s.user.role, status: s.user.status, marketing: s.user.marketing, clubCode: s.user.clubCode, mfaOk: s.mfaOk } : null,
    providers: { google: hasGoogle(), apple: hasApple() },
    // false on a site where the database or email isn't set up yet (for example a preview copy)
    accounts: accountsReady(),
  }),
);
