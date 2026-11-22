/**
 * Performance test with Google Lighthouse (the same engine as PageSpeed Insights).
 * Phone (slow 4G + slower CPU, like a mid-range phone) and desktop, for the main pages.
 *
 * Run:   npx lighthouse --version   (or: npm i -g lighthouse)
 *        node tests/perf.mjs                       site on http://localhost:3000
 *        BASE=https://example.com node tests/perf.mjs
 * Writes tests/out/perf-report.md and one JSON per page.
 *
 * Note: scores on a laptop or a test server are only a guide. Check the real site with
 * https://pagespeed.web.dev after it goes live (real network, real CDN, real caching).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const LH = process.env.LIGHTHOUSE || "lighthouse";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PAGES = ["/", "/treatments", "/treatments/facials", "/skin-lens", "/account/sign-in", "/blog", "/newsletters"];
mkdirSync("tests/out/lighthouse", { recursive: true });

const rows = [];
for (const form of ["mobile", "desktop"]) {
  for (const path of PAGES) {
    const out = `tests/out/lighthouse/${form}-${path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home"}.json`;
    const args = [
      BASE + path,
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
      ...(form === "desktop" ? ["--preset=desktop"] : []),
    ];
    try {
      execFileSync(LH, args, { stdio: "ignore", env: { ...process.env, CHROME_PATH: CHROME }, timeout: 180000 });
      const r = JSON.parse(readFileSync(out, "utf8"));
      const c = r.categories, a = r.audits;
      const row = {
        form, path,
        perf: Math.round(c.performance.score * 100),
        a11y: Math.round(c.accessibility.score * 100),
        bp: Math.round(c["best-practices"].score * 100),
        seo: Math.round(c.seo.score * 100),
        lcp: (a["largest-contentful-paint"].numericValue / 1000).toFixed(1),
        cls: a["cumulative-layout-shift"].numericValue.toFixed(3),
        tbt: Math.round(a["total-blocking-time"].numericValue),
      };
      rows.push(row);
      console.log(`${form.padEnd(7)} ${path.padEnd(22)} perf ${row.perf}  a11y ${row.a11y}  best ${row.bp}  seo ${row.seo}  LCP ${row.lcp}s  CLS ${row.cls}  TBT ${row.tbt}ms`);
    } catch (e) {
      console.log(`${form} ${path}: Lighthouse failed (${String(e.message).slice(0, 120)})`);
    }
  }
}

const md = [
  "# Performance (Lighthouse)",
  "",
  `${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${BASE}`,
  "",
  "Phone = slow 4G and a 4× slower CPU (Lighthouse's standard phone test). Scores are out of 100.",
  "",
  "| Device | Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.form} | ${r.path} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} s | ${r.cls} | ${r.tbt} ms |`),
  "",
  "LCP = time until the main picture or text shows (good: under 2.5 s). CLS = how much the page jumps while loading (good: under 0.1). TBT = time the page can't respond to taps (good: under 200 ms).",
];
writeFileSync("tests/out/perf-report.md", md.join("\n") + "\n");
