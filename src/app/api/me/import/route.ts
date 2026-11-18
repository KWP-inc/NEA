import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { importDevice, importSchema } from "@/lib/server/glow";

export const dynamic = "force-dynamic";

/** First sign-in on a phone that already has My Glow data: copies it into the account, once. */
export const POST = api({ auth: "user", limit: ["me-write", 10] }, async (req, s) => {
  const b = await body(req, importSchema, 400 * 1024);
  if (!b) return bad();
  return json({ ok: true, imported: await importDevice(s!.user.id, b) });
});
