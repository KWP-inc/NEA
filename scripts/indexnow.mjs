#!/usr/bin/env node
/**
 * Sends every URL in the live sitemap to IndexNow (Bing and others) after a release.
 *   INDEXNOW_KEY=… SITE_URL=https://neaprecisionskin.com node scripts/indexnow.mjs
 */
const site = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const key = process.env.INDEXNOW_KEY;
if (!site || !key) {
  console.error("Set SITE_URL and INDEXNOW_KEY.");
  process.exit(1);
}
const xml = await (await fetch(`${site}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 10000);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/indexnow.txt`, urlList: urls }),
});
console.log(`IndexNow: sent ${urls.length} URLs → HTTP ${res.status}`);
