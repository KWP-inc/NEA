import { NextResponse } from "next/server";
import { api } from "@/lib/server/route";
import { notFound } from "@/lib/server/http";
import { hasGoogle } from "@/lib/server/env";
import { startUrl } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "public", limit: ["oauth", 20] }, async (req) => {
  if (!hasGoogle()) return notFound();
  return NextResponse.redirect(await startUrl("google", new URL(req.url).searchParams.get("next") || "/account"), 302);
});
