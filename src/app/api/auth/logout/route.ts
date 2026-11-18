import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { destroySession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const POST = api({ auth: "public" }, async () => {
  await destroySession();
  return json({ ok: true });
});
