import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, emailSchema, json, tooMany } from "@/lib/server/http";
import { signInOrStart, verifyCode } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";
const schema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) });

/** Step 2: check the code. Signs in, or (new email) moves on to the short sign-up form. */
export const POST = api({ auth: "public", limit: ["auth-verify", 20] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad("Please enter the 6-digit code.");
  const r = await verifyCode(b.email, b.code, req);
  if (r === "limited") return tooMany();
  if (r === "wrong") return bad("That code didn't work. Check it, or ask for a new one.");
  return json({ status: await signInOrStart({ email: b.email, provider: "email", sub: b.email }, req) });
});
