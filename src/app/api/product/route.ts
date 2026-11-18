import { NextResponse } from "next/server";
import { guard } from "@/lib/rate-limit";

/**
 * Skincare product lookup for the Routine Builder, by barcode (?code=) or by name (?q=).
 * Data comes from Open Beauty Facts (openbeautyfacts.org), a free, open, community database (ODbL licence).
 * Read on the server and cached for a day. Not every product is in it; the Routine Builder lets people add those by hand.
 */
const OBF = "https://world.openbeautyfacts.org";
const FIELDS = "code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,image_front_small_url,categories";
const UA = "NEAPrecisionSkin-RoutineBuilder/1.0 (https://neaprecisionskin.com)";

type Raw = { code?: string; product_name?: string; product_name_en?: string; brands?: string; ingredients_text?: string; ingredients_text_en?: string; image_front_small_url?: string; categories?: string };
const clean = (p: Raw) => {
  const name = (p.product_name_en || p.product_name || "").trim().slice(0, 120);
  if (!name) return null;
  const image = p.image_front_small_url && /^https:\/\/[a-z0-9.-]*open(beauty|food|products)facts\.org\//.test(p.image_front_small_url) ? p.image_front_small_url : undefined;
  return { code: String(p.code ?? ""), name, brand: (p.brands || "").split(",")[0].trim().slice(0, 60) || undefined, ingredients: (p.ingredients_text_en || p.ingredients_text || "").slice(0, 4000), categories: (p.categories || "").slice(0, 300), image };
};

export async function GET(req: Request) {
  const g = await guard(req, "product", 30);
  if (g) return g;
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").replace(/\D/g, "");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const opts = { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) };
  try {
    if (code) {
      if (code.length < 8 || code.length > 14) return NextResponse.json({ error: "That doesn't look like a barcode." }, { status: 400 });
      const res = await fetch(`${OBF}/api/v2/product/${code}.json?fields=${FIELDS}`, opts);
      const d = (await res.json().catch(() => ({}))) as { status?: number; product?: Raw };
      const p = d.status === 1 && d.product ? clean({ ...d.product, code }) : null;
      return NextResponse.json({ products: p ? [p] : [] });
    }
    if (q.length >= 2) {
      const res = await fetch(`${OBF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=${FIELDS}`, opts);
      const d = (await res.json().catch(() => ({}))) as { products?: Raw[] };
      return NextResponse.json({ products: (d.products ?? []).map(clean).filter(Boolean).slice(0, 8) });
    }
    return NextResponse.json({ error: "Send a barcode or a product name." }, { status: 400 });
  } catch (e) {
    console.error("[product]", e);
    return NextResponse.json({ error: "The product list is not answering right now. Add your product by type instead." }, { status: 503 });
  }
}
