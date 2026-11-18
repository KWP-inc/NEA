import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, cleanText, emailSchema, json } from "@/lib/server/http";
import { checkCaptcha } from "@/lib/server/captcha";
import { asAnon } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { hmac } from "@/lib/server/crypto";
import { sendMail } from "@/lib/server/email";
import { getSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * Every form on the site (skin scan, consultation, contact, partner, magazine, experience).
 * 1. Captcha + honeypot + rate limit stop bots.
 * 2. Fields are checked against a schema; nothing else is accepted.
 * 3. The lead is saved in the database (staff see it on the staff page).
 * 4. Optional: forwarded to LEAD_WEBHOOK_URL (Zapier, Make, a CRM), signed with LEAD_WEBHOOK_SECRET,
 *    and emailed to STAFF_NOTIFY_EMAIL.
 */
const short = cleanText(120);
const schema = z.object({
  kind: z.enum(["skin-scan", "consultation", "contact", "partner", "magazine", "experience"]),
  source: short.optional(),
  captcha: z.string().max(2000),
  company_website: z.string().max(200).optional(), // honeypot: people never see it
  name: short.optional(),
  firstName: short.optional(),
  lastName: short.optional(),
  email: z.union([emailSchema, z.literal("")]).optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-.\s]*$/)
    .optional(),
  message: cleanText(2000, true).optional(),
  age: short.optional(),
  concern: short.optional(),
  time: short.optional(),
  topic: short.optional(),
  business: short.optional(),
  type: short.optional(),
  members: z.union([z.string().max(10), z.number().int().min(0).max(1_000_000)]).optional(),
  ref: z
    .string()
    .max(12)
    .regex(/^[A-Z0-9]*$/)
    .optional(),
});

export const POST = api({ auth: "public", limit: ["lead", 6] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad("Please check the form and try again.");
  if (b.company_website) return json({ ok: true }); // bot filled the hidden field: pretend it worked
  if (!(await checkCaptcha(b.captcha))) return bad("Please try again (security check).");
  if (!b.email && !b.phone) return bad("Add an email or phone number.");

  const name = (b.name || [b.firstName, b.lastName].filter(Boolean).join(" ")).trim() || "(no name)";
  const { captcha: _c, company_website: _h, kind, email, phone, message, ...meta } = b;
  void _c;
  void _h;
  const s = await getSession().catch(() => null);
  // visitors may add a lead but never read one back (RLS), so the id is made here instead of RETURNING it
  const row = { id: randomUUID() };
  await asAnon((q) =>
    q("INSERT INTO leads (id, kind, name, email, phone, message, meta, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
      row.id,
      kind,
      name,
      email || null,
      phone || null,
      message || null,
      JSON.stringify(meta),
      s?.user.id ?? null,
    ]),
  );

  const lead = { id: row?.id, kind, name, email, phone, message, ...meta, receivedAt: new Date().toISOString() };
  if (env.leadWebhook) {
    const payload = JSON.stringify(lead);
    const ts = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-NEA-Timestamp": ts };
    if (env.leadWebhookSecret) headers["X-NEA-Signature"] = `sha256=${hmac(env.leadWebhookSecret, `${ts}.${payload}`)}`;
    // the webhook URL is set by NEA in the server env, never by a visitor
    fetch(env.leadWebhook, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(8000) }).catch((e) =>
      console.error(JSON.stringify({ level: "error", msg: "lead webhook failed", err: String(e), lead: row?.id })),
    );
  }
  if (env.staffNotify) {
    sendMail(
      env.staffNotify,
      `New ${kind} request: ${name}`,
      "New website request",
      `<p>${kind} from ${name.replace(/[<>&]/g, "")}. Open the staff page to see it.</p>`,
      `New ${kind} request from ${name}. Open the staff page to see it.`,
    ).catch(() => {});
  }
  return json({ ok: true });
});
