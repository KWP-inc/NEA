import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { earn } from "@/lib/server/glow";

export const dynamic = "force-dynamic";
const schema = z.object({ kind: z.enum(["routine", "event", "planner", "share", "code"]), code: z.string().trim().max(40).optional() });

/** Asks for Glow Club points. The server decides (once, once a day, or valid clinic code). */
export const POST = api({ auth: "user", limit: ["me-points", 20] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b || (b.kind === "code" && !b.code)) return bad();
  const pts = await earn(s!.user.id, b.kind, b.code);
  if (b.kind === "code" && pts === 0) return json({ error: "That code didn't work, or you've used it today." }, 404);
  return json({ ok: true, pts });
});
