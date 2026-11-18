import { api } from "@/lib/server/route";
import { json } from "@/lib/server/http";
import { newChallenge } from "@/lib/server/captcha";

export const dynamic = "force-dynamic";

/** A fresh captcha puzzle for public forms (sign-in, contact, parent consent). */
export const GET = api({ auth: "public", limit: ["captcha", 60] }, async () => json(await newChallenge()));
