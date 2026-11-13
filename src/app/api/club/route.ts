import { NextResponse } from "next/server";
import { allow, tooMany } from "@/lib/rate-limit";

/**
 * Glow Club clinic codes. The front desk gives a code after a visit (or when a referred friend books);
 * the visitor types it in and gets points. Codes live only on the server, in CLUB_CODES:
 *   CLUB_CODES="GLOW50=50=Clinic visit,FRIEND100=100=Friend booked"
 * Change the codes whenever you like. Without CLUB_CODES the code box is hidden.
 */
export const dynamic = "force-dynamic";

function codes() {
  const out = new Map<string, { pts: number; label: string }>();
  for (const part of (process.env.CLUB_CODES || "").split(",")) {
    const [code, pts, label] = part.split("=").map((s) => s.trim());
    const n = Number(pts);
    if (code && Number.isFinite(n) && n > 0 && n <= 1000) out.set(code.toUpperCase(), { pts: Math.round(n), label: label || "Clinic visit" });
  }
  return out;
}

export function GET() {
  return NextResponse.json({ codes: codes().size > 0 });
}

export async function POST(req: Request) {
  if (!allow(req, "club", 8)) return tooMany();
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase().slice(0, 40) : "";
  const hit = code ? codes().get(code) : undefined;
  if (!hit) return NextResponse.json({ error: "That code didn't work. Check it with the front desk." }, { status: 404 });
  return NextResponse.json({ ok: true, code, ...hit });
}
