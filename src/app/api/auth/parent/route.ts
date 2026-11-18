import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { checkCaptcha } from "@/lib/server/captcha";
import { parentDecide } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";
const schema = z.object({ t: z.string().min(20).max(100), yes: z.boolean(), captcha: z.string().max(2000) });

/** A parent says yes (account turns on) or no (account is deleted). */
export const POST = api({ auth: "public", limit: ["parent", 10] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad();
  if (!(await checkCaptcha(b.captcha))) return bad("Please try again (security check).");
  return (await parentDecide(b.t, b.yes, req)) ? json({ ok: true }) : bad("This link has expired or was already used.");
});
