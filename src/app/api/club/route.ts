import { z } from "zod";
import { api } from "@/lib/server/route";
import { bad, body, json } from "@/lib/server/http";
import { clubCodes } from "@/lib/server/glow";

export const dynamic = "force-dynamic";

/**
 * Glow Club clinic codes. The front desk gives a code after a visit (or when a referred friend books).
 * Codes live only on the server, in CLUB_CODES:  CLUB_CODES="GLOW50=50=Clinic visit,FRIEND100=100=Friend booked"
 * Checking a code needs a signed-in member; the points themselves are given by POST /api/me/points.
 */
export const GET = api({ auth: "public" }, async () => json({ codes: clubCodes().size > 0 }));

const schema = z.object({ code: z.string().trim().min(2).max(40) });

export const POST = api({ auth: "user", limit: ["club", 8] }, async (req) => {
  const b = await body(req, schema);
  if (!b) return bad();
  const code = b.code.toUpperCase();
  const hit = clubCodes().get(code);
  if (!hit) return json({ error: "That code didn't work. Check it with the front desk." }, 404);
  return json({ ok: true, code, ...hit });
});
