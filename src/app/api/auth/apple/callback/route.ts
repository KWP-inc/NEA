import { NextResponse } from "next/server";
import { api } from "@/lib/server/route";
import { env } from "@/lib/server/env";
import { finishApple } from "@/lib/server/oauth";
import { signInOrStart } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";

/**
 * Apple posts the result from appleid.apple.com, so the Origin check is off for this one route.
 * It's protected instead by the one-time `state` value tied to this browser, plus the signed ID token.
 */
export const POST = api({ auth: "public", csrf: false, limit: ["oauth", 20] }, async (req) => {
  const form = await req.formData().catch(() => null);
  const r = form ? await finishApple(form).catch(() => null) : null;
  if (!r) return NextResponse.redirect(`${env.siteUrl}/account/sign-in?error=apple`, 303);
  const status = await signInOrStart({ email: r.email, provider: "apple", sub: r.sub, name: r.name }, req);
  if (status === "blocked") return NextResponse.redirect(`${env.siteUrl}/account/sign-in?error=staff`, 303);
  return NextResponse.redirect(`${env.siteUrl}${status === "signed-in" ? r.next : "/account/welcome"}`, 303);
});
