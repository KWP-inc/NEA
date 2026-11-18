/**
 * IndexNow (Bing, Yandex, Seznam…): tells search engines a page changed, so it's re-crawled within minutes.
 * The key file lives here; `npm run seo:indexnow` sends the sitemap URLs. Set INDEXNOW_KEY (any 32+ hex characters).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = (process.env.INDEXNOW_KEY || "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
