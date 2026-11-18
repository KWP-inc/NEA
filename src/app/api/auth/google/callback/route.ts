import { NextResponse } from "next/server";
import { api } from "@/lib/server/route";
import { env } from "@/lib/server/env";
import { finishGoogle } from "@/lib/server/oauth";
import { signInOrStart } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "public", limit: ["oauth", 20] }, async (req) => {
  const u = new URL(req.url);
  const r = await finishGoogle(u.searchParams.get("code"), u.searchParams.get("state")).catch(() => null);
  if (!r) return NextResponse.redirect(`${env.siteUrl}/account/sign-in?error=google`, 303);
  const status = await signInOrStart({ email: r.email, provider: "google", sub: r.sub, name: r.name }, req);
  if (status === "blocked") return NextResponse.redirect(`${env.siteUrl}/account/sign-in?error=staff`, 303);
  return NextResponse.redirect(`${env.siteUrl}${status === "signed-in" ? r.next : "/account/welcome"}`, 303);
});
