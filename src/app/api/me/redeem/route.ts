import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { redeem } from "@/lib/server/glow";

export const dynamic = "force-dynamic";
const schema = z.object({ reward: z.string().max(40) });

export const POST = api({ auth: "user", limit: ["me-points", 20] }, async (req, s) => {
  const b = await body(req, schema);
  if (!b) return bad();
  const r = await redeem(s!.user.id, b.reward);
  return r ? json({ ok: true, redeemed: r }) : bad("Not enough points for that reward yet.");
});
