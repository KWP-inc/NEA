import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, emailSchema, json, tooMany } from "@/lib/server/http";
import { checkCaptcha } from "@/lib/server/captcha";
import { requestCode } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";
const schema = z.object({ email: emailSchema, captcha: z.string().max(2000) });

/** Step 1 of sign-in: email a 6-digit code. Same answer whether or not the email has an account. */
export const POST = api({ auth: "public", limit: ["auth-code", 10] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad("Please enter a valid email.");
  if (!(await checkCaptcha(b.captcha))) return bad("Please try again (security check).");
  if ((await requestCode(b.email, req)) === "limited") return tooMany();
  return json({ ok: true });
});
