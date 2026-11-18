import { NextResponse } from "next/server";
import { api } from "@/lib/server/route";
import { notFound } from "@/lib/server/http";
import { hasApple } from "@/lib/server/env";
import { startUrl } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "public", limit: ["oauth", 20] }, async (req) => {
  if (!hasApple()) return notFound();
  return NextResponse.redirect(await startUrl("apple", new URL(req.url).searchParams.get("next") || "/account"), 302);
});
