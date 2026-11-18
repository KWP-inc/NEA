import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json, notFound } from "@/lib/server/http";
import { mfaSetup, mfaState, mfaVerify, staffBeforeMfa } from "@/lib/server/staff";
import { asStaff } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { clientIp } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Two-step sign-in state, and the QR code the first time. Staff only (404 for anyone else). */
export const GET = api({ auth: "public", limit: ["staff-mfa", 30] }, async () => {
  const s = await staffBeforeMfa();
  if (!s) return notFound();
  const state = await mfaState(s.user.id);
  if (state === "ready") return json({ state, mfaOk: s.mfaOk });
  return json({ state, mfaOk: false, ...(await mfaSetup(s)) });
});

const schema = z.object({ code: z.string().trim().min(6).max(24) });

export const POST = api({ auth: "public", limit: ["staff-mfa", 10] }, async (req) => {
  const s = await staffBeforeMfa();
  if (!s) return notFound();
  const b = await body(req, schema);
  if (!b) return bad("Enter the 6-digit code from your app.");
  const r = await mfaVerify(s, b.code, req);
  if (r.locked) return bad("Too many wrong codes. Wait 15 minutes, or ask an admin to reset your two-step sign-in.");
  if (!r.ok) return bad("That code didn't work. Codes change every 30 seconds, and each one works once.");
  await asStaff(s.user.id, s.user.role === "admin" ? "admin" : "staff", (q) => audit(q, s.user.id, "staff.signin", s.user.id, { mfa: true }, clientIp(req)));
  return json({ ok: true, backupCodes: r.backupCodes });
});
