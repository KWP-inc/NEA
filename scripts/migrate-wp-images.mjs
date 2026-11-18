#!/usr/bin/env node
/**
 * Copies every NEA photo still hosted on the old WordPress site into public/media/wp/, so the new site
 * keeps working after the domain moves off WordPress. Run once on any computer with internet, then commit:
 *   npm run media:migrate
 *   git add public/media/wp src/content/generated/wp-local.json && git commit -m "perf(media): serve WordPress photos from the site"
 * Safe to run again: files already copied are skipped.
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const WP = "https://neaprecisionskin.com/wp-content/uploads/";
const OUT = path.join(ROOT, "public/media/wp");
const LIST = path.join(ROOT, "src/content/generated/wp-local.json");

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(tsx?|json)$/.test(e.name) && !p.endsWith("wp-local.json")) yield p;
  }
}

const found = new Set();
for await (const f of files(path.join(ROOT, "src"))) {
  const text = await readFile(f, "utf8");
  for (const m of text.matchAll(/https:\/\/neaprecisionskin\.com\/wp-content\/uploads\/([^"'\s)<>]+)/g)) found.add(m[1]);
  for (const m of text.matchAll(/["'`](\d{4}\/\d{2}\/[^"'`\s]+\.(?:jpe?g|png|webp|gif|svg|pdf|mp4))["'`]/gi)) found.add(m[1]);
}
const ok = [];
let fetched = 0;
for (const rel of [...found].sort()) {
  if (rel.includes("${") || rel.includes("..")) continue;
  const dest = path.join(OUT, rel);
  try {
    await stat(dest);
    ok.push(rel);
    continue;
  } catch {
    /* not copied yet */
  }
  try {
    const res = await fetch(WP + rel);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    ok.push(rel);
    fetched++;
    process.stdout.write(".");
  } catch (e) {
    console.warn(`\nskipped ${rel}: ${e.message}`);
  }
}
await writeFile(LIST, JSON.stringify(ok.sort(), null, 1) + "\n");
console.log(`\n${fetched} downloaded, ${ok.length} of ${found.size} photos now served from /media/wp.`);
