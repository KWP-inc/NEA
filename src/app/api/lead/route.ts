import { NextResponse } from "next/server";
import { allow, tooMany } from "@/lib/rate-limit";

/**
 * Receives every form on the site (skin scan, consultation, partner, contact…).
 * Set LEAD_WEBHOOK_URL to forward leads to Zapier/Make/your CRM, so the
 * "reply within 15 minutes" rule can be automated with SMS.
 * A referral code (from a Glow Club link) travels with the lead as `ref`.
 */
export async function POST(req: Request) {
  if (!allow(req, "lead", 6)) return tooMany();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  // keep only short, plain values so nothing oversized or nested reaches the CRM
  const body: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
    if (typeof v === "string") body[k.slice(0, 40)] = v.slice(0, 2000);
    else if (typeof v === "number" || typeof v === "boolean") body[k.slice(0, 40)] = v;
  }
  if (body.company_website) return NextResponse.json({ ok: true }); // honeypot
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!email && !phone) return NextResponse.json({ error: "Add an email or phone number" }, { status: 422 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Check the email address" }, { status: 422 });

  const lead = { ...body, receivedAt: new Date().toISOString() };
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    try {
      const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
    } catch (e) {
      console.error("[lead] delivery failed:", e, lead);
      return NextResponse.json({ error: "Could not deliver the request. Please call us instead." }, { status: 502 });
    }
  } else {
    // no webhook set: the lead is only in the server log. Set LEAD_WEBHOOK_URL so someone receives it.
    console.warn("[lead] LEAD_WEBHOOK_URL is not set; lead logged only:", lead);
  }
  return NextResponse.json({ ok: true });
}
