import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, cleanText, clientIp, emailSchema, json } from "@/lib/server/http";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { destroyAllSessions } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { mailStaffInvite } from "@/lib/server/email";

export const dynamic = "force-dynamic";

/** Admin only: the staff list. */
export const GET = api({ auth: "admin", limit: ["staff", 60] }, async (_req, s) =>
  json({
    rows: await asStaff(s!.user.id, "admin", (q) =>
      q("SELECT u.id, u.name, u.email, u.role, u.status, u.last_seen_at, (m.confirmed_at IS NOT NULL) AS mfa FROM users u LEFT JOIN staff_mfa m ON m.user_id = u.id WHERE u.role IN ('staff', 'admin') ORDER BY u.role, u.email"),
    ),
  }),
);

const add = z.object({ email: emailSchema, name: cleanText(80).default(""), role: z.enum(["staff", "admin"]) });

/** Add a staff member (or promote an existing account). They sign in with their email code, then set up two-step. */
export const POST = api({ auth: "admin", limit: ["staff-write", 20] }, async (req, s) => {
  const b = await body(req, add);
  if (!b) return bad("Enter an email and pick a role.");
  const id = await asStaff(s!.user.id, "admin", async (q) => {
    const [u] = await q<{ id: string }>(
      `INSERT INTO users (email, name, role, status) VALUES ($1, $2, $3, 'active')
       ON CONFLICT ((lower(email))) DO UPDATE SET role = EXCLUDED.role RETURNING id`,
      [b.email, b.name, b.role],
    );
    await q("INSERT INTO auth_identities (user_id, provider, provider_sub) VALUES ($1, 'email', $2) ON CONFLICT DO NOTHING", [u.id, b.email]);
    await audit(q, s!.user.id, "staff.add", u.id, { email: b.email, role: b.role }, clientIp(req));
    return u.id;
  });
  await destroyAllSessions(id).catch(() => {});
  if (env.adminPath) await mailStaffInvite(b.email, `${env.siteUrl}/account/sign-in?next=/${env.adminPath}`).catch(() => {});
  return json({ ok: true });
});

const change = z.object({ id: z.string().uuid(), role: z.enum(["member", "staff", "admin"]).optional(), resetMfa: z.boolean().optional() });

/** Change a role, remove staff access (back to member), or reset someone's two-step sign-in. Signs them out everywhere. */
export const PATCH = api({ auth: "admin", limit: ["staff-write", 20] }, async (req, s) => {
  const b = await body(req, change);
  if (!b || (!b.role && !b.resetMfa)) return bad();
  if (b.id === s!.user.id && b.role && b.role !== "admin") return bad("You can't remove your own admin access.");
  await asStaff(s!.user.id, "admin", async (q) => {
    if (b.role) await q("UPDATE users SET role = $2 WHERE id = $1", [b.id, b.role]);
    if (b.resetMfa || b.role === "member") await q("DELETE FROM staff_mfa WHERE user_id = $1", [b.id]);
    await audit(q, s!.user.id, b.role ? "staff.role" : "staff.mfa_reset", b.id, { role: b.role, resetMfa: b.resetMfa }, clientIp(req));
  });
  await destroyAllSessions(b.id).catch(() => {});
  return json({ ok: true });
});
