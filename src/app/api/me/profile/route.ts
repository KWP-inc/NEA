import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, cleanText, clientIp, json } from "@/lib/server/http";
import { asUser } from "@/lib/server/db";
import { ADULT_AGE, PRIVACY_VERSION, ageFrom } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
const schema = z.object({ name: cleanText(80).pipe(z.string().min(1)).optional(), marketing: z.boolean().optional() });

/** Change your name or marketing emails. Every consent change is kept as a new row (proof). */
export const PATCH = api({ auth: "user", limit: ["me-write", 30] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b) return bad();
  const minor = s!.user.birthYm ? ageFrom(s!.user.birthYm) < ADULT_AGE : false;
  if (b.marketing && minor) return bad("Marketing emails are only for adults.");
  await asUser(s!.user.id, async (q) => {
    if (b.name) await q("UPDATE users SET name = $2 WHERE id = $1", [s!.user.id, b.name]);
    if (typeof b.marketing === "boolean" && b.marketing !== s!.user.marketing) {
      await q("UPDATE users SET marketing = $2 WHERE id = $1", [s!.user.id, b.marketing]);
      await q("INSERT INTO consents (user_id, kind, version, given, ip) VALUES ($1, 'marketing', $2, $3, $4)", [s!.user.id, PRIVACY_VERSION, b.marketing, clientIp(req)]);
    }
  });
  return json({ ok: true });
});
