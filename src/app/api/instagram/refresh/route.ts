import { safeEqual } from "@/lib/server/crypto";
import { NextResponse } from "next/server";
import { refreshToken } from "@/lib/instagram";

/**
 * Keeps the Instagram token alive (tokens last 60 days; each refresh restarts the clock).
 * Called weekly by the server cron (see DEPLOY.md). Needs CRON_SECRET; without it this route is off.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`)) return new NextResponse("Not found", { status: 404 });
  const result = await refreshToken();
  if (result.ok && result.tokenChanged) console.warn("[instagram] Instagram returned a new token. Paste it into INSTAGRAM_ACCESS_TOKEN.");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
