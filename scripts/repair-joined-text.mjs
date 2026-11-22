#!/usr/bin/env node
/**
 * One-time repair of text copied from the old WordPress site (update 27).
 * The copy lost the breaks between list items and some sentences, so text read like
 * "Greater penetration of skincare productsMakeup glides on smoothly.No downtime".
 * This splits those runs back into list items (or headings and paragraphs) and adds the
 * missing space after full stops. Brand names written in mixed case (truSculpt, NightLase…) are kept.
 * Safe to run again: already-repaired text has nothing left to split.
 *   node scripts/repair-joined-text.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../src/content/generated/", import.meta.url);
const BRANDS = [
  "BioAro", "BioDental", "BioFemme", "BioGenome", "BioGut", "BioSkin", "BioSport", "truSculpt", "truControl", "TruFlex",
  "ClearSteps", "IntimaLase", "IncontiLase", "NightLase", "SmoothLiftin", "SupErficial", "TightSculpting", "AlumierMD",
  "LinkedIn", "LinkedIN", "iFrames", "iPhone", "YouTube", "TikTok", "PicoSure", "SmoothEye", "LipLase", "McCrink",
];
const UP = "A-ZÀ-ÖØ-Þ";
const LO = "a-zß-öø-ÿ";

/** Hide brand words so their inner capital letters aren't read as breaks. */
function protect(s) {
  const kept = [];
  let out = s;
  BRANDS.forEach((b) => {
    out = out.replace(new RegExp(b, "g"), (m) => {
      kept.push(m);
      return `\u0001${kept.length - 1}\u0002`;
    });
  });
  return { out, kept };
}
const restore = (s, kept) => s.replace(/\u0001(\d+)\u0002/g, (_, i) => kept[Number(i)]);

const LIST_BREAK = new RegExp(`(?<=[${LO}\\)®™])(?=[${UP}][${LO}]|\\u0001)`, "g");
const SENTENCE_BREAK = new RegExp(`(?<=[.!?:])(?=[${UP}\\u0001])`, "g");

/** Fixes "a"/"an"/"the" glued to the next word ("aRegistered" → "a Registered") and "Cutera’struSculpt". */
function smallFixes(s) {
  return s
    .replace(new RegExp(`\\b(a|an|the)(?=[${UP}][${LO}])`, "g"), "$1 ")
    .replace(/’s(?=\u0001)/g, "’s ");
}

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** Splits one paragraph into blocks. Returns null when nothing needs changing. */
function split(text) {
  if (!text || /https?:\/\//.test(text)) return null;
  const { out, kept } = protect(smallFixes(text));
  const listBreaks = out.match(LIST_BREAK);
  if (!listBreaks) {
    const spaced = out.replace(SENTENCE_BREAK, " ");
    return spaced === out ? null : [{ type: "p", text: restore(spaced, kept) }];
  }
  const parts = out
    .split(LIST_BREAK)
    .flatMap((p) => p.split(SENTENCE_BREAK))
    .map((p) => restore(p, kept).trim())
    .filter(Boolean);
  // long parts are paragraphs; short ones are list items; a short part sitting right before a
  // paragraph (and not inside a list) is a heading ("After Your Facial Peel", "Treatment")
  const labelled = (p) => /^[^\s]+(\s[^\s]+){0,3}\s[–-]\s/.test(p) || /^[A-Z][^.:]{2,40}:\s/.test(p);
  const kind = parts.map((p) => (/:$/.test(p) ? "p" : labelled(p) ? "li" : words(p) >= 14 ? "p" : "li"));
  kind.forEach((k, i) => {
    if (k === "li" && kind[i + 1] === "p" && (i === 0 || kind[i - 1] === "p") && words(parts[i]) <= 6 && !/[.!?]$/.test(parts[i])) kind[i] = "h";
  });
  // a run of exactly one list item between paragraphs reads better as a sentence
  kind.forEach((k, i) => {
    if (k === "li" && kind[i - 1] !== "li" && kind[i + 1] !== "li" && !labelled(parts[i])) kind[i] = "p";
  });
  return parts.map((p, i) => ({ type: kind[i], text: p }));
}

let fixed = 0;
function fixBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === "h" && SENTENCE_BREAK.test(b.text)) {
      SENTENCE_BREAK.lastIndex = 0;
      out.push({ ...b, text: b.text.replace(SENTENCE_BREAK, " ") });
      fixed++;
      continue;
    }
    if (b.type === "p" || b.type === "li") {
      const r = split(b.text);
      if (r) {
        fixed++;
        out.push(...(b.type === "li" ? r.map((x) => ({ ...x, type: x.type === "p" ? "li" : x.type })) : r));
        continue;
      }
    }
    out.push(b);
  }
  return out;
}
function fixStrings(arr, asList) {
  const out = [];
  for (const s of arr) {
    const r = split(s);
    if (!r) {
      out.push(s);
      continue;
    }
    fixed++;
    if (asList) {
      // "Ice pick scars: Deep, narrow scars. Boxcar scars: …" → one item per "Label:"
      for (const x of r) out.push(...x.text.split(/(?<=[.!?])\s+(?=[A-Z][^.:]{2,40}:\s)/));
    }
    else out.push(r.map((x) => x.text).join(r.some((x) => x.type !== "p") ? "\n" : " "));
  }
  return out;
}

// treatments: intro paragraphs, list items, sub-section bodies, extra sections
const tPath = new URL("treatments.json", DIR);
const treatments = JSON.parse(await readFile(tPath, "utf8"));
for (const t of treatments) {
  // an intro paragraph that hides a list becomes paragraph(s) + list items in `more`
  const introBlocks = fixBlocks(t.intro.map((text) => ({ type: "p", text })));
  t.intro = introBlocks.filter((b) => b.type === "p").map((b) => b.text);
  const introRest = introBlocks.filter((b) => b.type !== "p");
  if (introRest.length) t.more = [introRest, ...t.more];
  t.list = fixStrings(t.list, true);
  for (const s of t.subs) s.body = fixBlocks(s.body);
  t.more = t.more.map((m) => fixBlocks(m));
}
await writeFile(tPath, JSON.stringify(treatments, null, 1) + "\n");

// pages and blog posts
for (const name of ["pages.json", "blog.json", "legal.json"]) {
  const p = new URL(name, DIR);
  const data = JSON.parse(await readFile(p, "utf8"));
  const walk = (v) => {
    if (Array.isArray(v) && v.length && v.every((b) => b && typeof b === "object" && "type" in b && "text" in b)) return fixBlocks(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) v[k] = walk(v[k]);
      return v;
    }
    return v;
  };
  await writeFile(p, JSON.stringify(walk(data), null, 1) + "\n");
}
console.log(`repaired ${fixed} joined paragraphs`);
