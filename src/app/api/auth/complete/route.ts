import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, cleanText, emailSchema, json } from "@/lib/server/http";
import { completeSignup, pendingSignup } from "@/lib/server/accounts";

export const dynamic = "force-dynamic";
const schema = z.object({
  name: cleanText(80).pipe(z.string().min(1)),
  birthYm: z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/),
  privacy: z.literal(true),
  marketing: z.boolean().default(false),
  parentEmail: emailSchema.optional(),
});

/** What the sign-up form needs to know (the proven email and name from Google or Apple). */
export const GET = api({ auth: "public" }, async () => {
  const p = await pendingSignup();
  return json(p ? { email: p.email, name: p.name ?? "" } : { email: null });
});

/** Step 3 (new people only): name, birth month, consent; under 18 adds a parent's email. */
export const POST = api({ auth: "public", limit: ["auth-complete", 10] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad("Please fill in every field and tick the privacy box.");
  const r = await completeSignup(b, req);
  return r.ok ? json(r) : bad(r.error);
});
