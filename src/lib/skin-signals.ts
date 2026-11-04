/**
 * NEA live face scan: the maths, all run on the visitor's own phone.
 * - Pulse: remote photoplethysmography (rPPG). Each heartbeat changes the colour of facial skin very slightly;
 *   the CHROM method (de Haan & Jeanne, 2013) turns those colour changes into a pulse wave.
 * - Stress: from heart rate and how much the time between beats varies (heart-rate variability, RMSSD).
 * - Blinks: from how open the eyes are, frame by frame.
 * - Skin: colour, shine, evenness and smoothness of small skin patches (CIE Lab colour).
 * These are estimates for guidance, not medical measurements.
 */

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** sRGB 0–255 to CIE Lab (D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** A loose skin test in YCbCr that works across skin tones; it only filters out hair, eyes, brows and background. */
export function isSkin(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 35 && cb > 72 && cb < 132 && cr > 130 && cr < 180;
}

export type PatchStats = {
  n: number; // skin pixels used
  rgb: [number, number, number];
  L: number;
  a: number;
  b: number;
  sd: number; // spread of lightness
  lap: number; // fine texture: mean |Laplacian| of lightness, per 100 L
  shine: number; // share of bright, colourless pixels (oil/shine)
  glow: number; // share of soft highlights (a healthy, dewy look)
  spots: number; // share of clearly darker pixels (spots, marks)
};

/**
 * Reads one square skin patch. `data` is RGBA, `w`×`h` pixels; the patch is centred on (cx, cy) with half-size `half`.
 * Returns null if too little of it is skin.
 */
export function readPatch(data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, half: number): PatchStats | null {
  const x0 = Math.max(1, Math.round(cx - half));
  const x1 = Math.min(w - 2, Math.round(cx + half));
  const y0 = Math.max(1, Math.round(cy - half));
  const y1 = Math.min(h - 2, Math.round(cy + half));
  const pw = x1 - x0 + 1;
  const ph = y1 - y0 + 1;
  if (pw < 4 || ph < 4) return null;
  const Ls = new Float32Array(pw * ph);
  const skin = new Uint8Array(pw * ph);
  let n = 0;
  let sr = 0, sg = 0, sb = 0, sL = 0, sa = 0, sB = 0, sL2 = 0;
  const chroma = new Float32Array(pw * ph);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [L, A, B] = rgbToLab(r, g, b);
      const k = (y - y0) * pw + (x - x0);
      Ls[k] = L;
      chroma[k] = Math.hypot(A, B);
      // highlights on oily skin go almost white, so they fail the colour test; keep them if they're bright
      const ok = isSkin(r, g, b) || (L > 70 && chroma[k] < 22);
      if (!ok) continue;
      skin[k] = 1;
      n++;
      sr += r;
      sg += g;
      sb += b;
      sL += L;
      sa += A;
      sB += B;
      sL2 += L * L;
    }
  }
  if (n < pw * ph * 0.45) return null;
  const L = sL / n;
  const sd = Math.sqrt(Math.max(0, sL2 / n - L * L));
  let lap = 0, ln = 0, shine = 0, glow = 0, spots = 0;
  for (let y = 1; y < ph - 1; y++) {
    for (let x = 1; x < pw - 1; x++) {
      const k = y * pw + x;
      if (!skin[k]) continue;
      const v = Ls[k];
      lap += Math.abs(4 * v - Ls[k - 1] - Ls[k + 1] - Ls[k - pw] - Ls[k + pw]);
      ln++;
      if (v > L + 1.8 * sd && v > 62 && chroma[k] < 20) shine++;
      else if (v > L + 0.6 * sd && v <= L + 1.8 * sd) glow++;
      // a spot: darker than its own neighbourhood (a 5×5 ring), so face shading doesn't count
      if (x > 2 && y > 2 && x < pw - 3 && y < ph - 3) {
        const ring = (Ls[k - 2 * pw - 2] + Ls[k - 2 * pw + 2] + Ls[k + 2 * pw - 2] + Ls[k + 2 * pw + 2] + Ls[k - 2] + Ls[k + 2] + Ls[k - 2 * pw] + Ls[k + 2 * pw]) / 8;
        if (ring - v > 6) spots++;
      }
    }
  }
  const m = Math.max(1, ln);
  return { n, rgb: [sr / n, sg / n, sb / n], L, a: sa / n, b: sB / n, sd, lap: ((lap / m) * 100) / Math.max(20, L), shine: shine / m, glow: glow / m, spots: spots / m };
}

/** Running average of patch readings over many frames. */
export class PatchAverage {
  private sum: Record<keyof Omit<PatchStats, "rgb" | "n">, number> = { L: 0, a: 0, b: 0, sd: 0, lap: 0, shine: 0, glow: 0, spots: 0 };
  count = 0;
  add(p: PatchStats | null) {
    if (!p) return;
    for (const k of Object.keys(this.sum) as (keyof typeof this.sum)[]) this.sum[k] += p[k];
    this.count++;
  }
  get(): Omit<PatchStats, "rgb" | "n"> | null {
    if (!this.count) return null;
    const o = { ...this.sum };
    for (const k of Object.keys(o) as (keyof typeof o)[]) o[k] /= this.count;
    return o;
  }
}

/* ───────────────────────── pulse ───────────────────────── */

const FS = 30; // resample everything to 30 samples a second

/** Linear resample of (t seconds, v) samples onto a uniform 30 Hz grid. */
function resample(ts: number[], vs: number[]) {
  const out: number[] = [];
  if (ts.length < 2) return out;
  let j = 0;
  for (let t = ts[0]; t <= ts[ts.length - 1]; t += 1 / FS) {
    while (j < ts.length - 2 && ts[j + 1] < t) j++;
    const f = (t - ts[j]) / Math.max(1e-6, ts[j + 1] - ts[j]);
    out.push(vs[j] + (vs[j + 1] - vs[j]) * clamp01(f));
  }
  return out;
}

/** Subtracts a centred moving average (removes slow drift from light and movement). */
function detrend(x: number[], win: number) {
  const out = new Array<number>(x.length);
  const h = Math.floor(win / 2);
  let s = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - h);
    const b = Math.min(x.length - 1, i + h);
    while (hi < b) s += x[++hi];
    while (lo < a) s -= x[lo++];
    out[i] = x[i] - s / (hi - lo + 1);
  }
  return out;
}

const std = (x: number[]) => {
  const m = x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, x.length));
};

/** Band-pass biquad (RBJ), run forwards and backwards so peaks don't shift in time. */
function bandpass(x: number[], f0: number, q: number) {
  const w = (2 * Math.PI * f0) / FS;
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al;
  const b0 = al / a0;
  const b2 = -al / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - al) / a0;
  const run = (s: number[]) => {
    const o = new Array<number>(s.length).fill(0);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < s.length; i++) {
      const y = b0 * s[i] + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = s[i];
      y2 = y1;
      y1 = y;
      o[i] = y;
    }
    return o;
  };
  return run(run(x).reverse()).reverse();
}

export type PulseReading = { bpm: number; quality: number; wave: number[] };

/** Collects skin colour over time and turns it into a pulse. */
export class PulseMeter {
  t: number[] = [];
  r: number[] = [];
  g: number[] = [];
  b: number[] = [];

  push(t: number, rgb: [number, number, number]) {
    this.t.push(t);
    this.r.push(rgb[0]);
    this.g.push(rgb[1]);
    this.b.push(rgb[2]);
  }
  /** Drops everything (used when the face is lost or moves a lot, so a jump doesn't look like a beat). */
  reset() {
    this.t = [];
    this.r = [];
    this.g = [];
    this.b = [];
  }
  get seconds() {
    return this.t.length > 1 ? this.t[this.t.length - 1] - this.t[0] : 0;
  }

  /** The CHROM pulse signal over the last `secs` seconds, at 30 Hz. */
  signal(secs = Infinity): number[] {
    const end = this.t.length;
    if (end < 30) return [];
    const t0 = this.t[end - 1] - secs;
    let s = 0;
    while (s < end && this.t[s] < t0) s++;
    const ts = this.t.slice(s);
    const R = resample(ts, this.r.slice(s));
    const G = resample(ts, this.g.slice(s));
    const B = resample(ts, this.b.slice(s));
    if (R.length < FS * 4) return [];
    // normalise each colour by its own slow average, so only the tiny pulse changes are left
    const norm = (c: number[]) => {
      const d = detrend(c, FS * 1.6);
      return c.map((v, i) => (v - d[i] > 0 ? v / (v - d[i]) : 1));
    };
    const rn = norm(R);
    const gn = norm(G);
    const bn = norm(B);
    const X = detrend(rn.map((v, i) => 3 * v - 2 * gn[i]), FS * 1.6);
    const Y = detrend(rn.map((v, i) => 1.5 * v + gn[i] - 1.5 * bn[i]), FS * 1.6);
    const k = std(X) / Math.max(1e-9, std(Y));
    return X.map((v, i) => v - k * Y[i]);
  }

  /** Heart rate from the strongest rhythm between 42 and 180 beats a minute (last 12 s). */
  read(): PulseReading | null {
    const S = this.signal(12);
    if (S.length < FS * 5) return null;
    const n = S.length;
    const win = S.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    let best = 0, bestF = 0, total = 0;
    const pw: number[] = [];
    for (let bpm = 42; bpm <= 180; bpm += 0.5) {
      const f = bpm / 60;
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const ph = (2 * Math.PI * f * i) / FS;
        re += win[i] * Math.cos(ph);
        im -= win[i] * Math.sin(ph);
      }
      const p = re * re + im * im;
      pw.push(p);
      total += p;
      if (p > best) (best = p), (bestF = bpm);
    }
    // quality: how much of the energy sits in the main peak (±3 bpm) versus everywhere else
    const i0 = Math.round((bestF - 42) * 2);
    let peak = 0;
    for (let i = Math.max(0, i0 - 6); i <= Math.min(pw.length - 1, i0 + 6); i++) peak += pw[i];
    const quality = clamp01((peak / Math.max(1e-12, total) - 0.12) / 0.4);
    const shown = bandpass(S, bestF / 60, 1.2).slice(-FS * 6);
    const m = Math.max(1e-9, ...shown.map(Math.abs));
    return { bpm: bestF, quality, wave: shown.map((v) => v / m) };
  }

  /** Beat-to-beat timing over the whole scan, for heart-rate variability. */
  beats(bpm: number): { rmssd: number; beats: number } | null {
    const S = this.signal();
    if (S.length < FS * 8) return null;
    const f0 = bpm / 60;
    const x = bandpass(S, f0, 1.0);
    const minGap = Math.floor((FS / f0) * 0.6);
    const peaks: number[] = [];
    for (let i = 1; i < x.length - 1; i++) {
      if (x[i] > 0 && x[i] >= x[i - 1] && x[i] > x[i + 1]) {
        // sub-sample peak time (parabola through 3 points)
        const den = x[i - 1] - 2 * x[i] + x[i + 1];
        const off = den !== 0 ? (0.5 * (x[i - 1] - x[i + 1])) / den : 0;
        const at = i + Math.max(-0.5, Math.min(0.5, off));
        if (peaks.length && at - peaks[peaks.length - 1] < minGap) {
          if (x[i] > x[Math.round(peaks[peaks.length - 1])]) peaks[peaks.length - 1] = at;
        } else peaks.push(at);
      }
    }
    const ibi = peaks.slice(1).map((p, i) => ((p - peaks[i]) / FS) * 1000);
    if (ibi.length < 6) return null;
    const med = [...ibi].sort((a, b) => a - b)[Math.floor(ibi.length / 2)];
    const good = ibi.filter((v) => Math.abs(v - med) < med * 0.22);
    if (good.length < 5) return null;
    let s = 0;
    for (let i = 1; i < good.length; i++) s += (good[i] - good[i - 1]) ** 2;
    return { rmssd: Math.sqrt(s / (good.length - 1)), beats: good.length + 1 };
  }
}

/* ───────────────────────── blinks ───────────────────────── */

/** Counts blinks from eye openness (height ÷ width of each eye), with a self-adjusting "open" level. */
export class BlinkCounter {
  private hist: number[] = [];
  private closed = false;
  blinks = 0;
  start = 0;
  last = 0;
  push(t: number, open: number) {
    if (!this.start) this.start = t;
    this.last = t;
    this.hist.push(open);
    if (this.hist.length > 90) this.hist.shift();
    const sorted = [...this.hist].sort((a, b) => a - b);
    const base = sorted[Math.floor(sorted.length * 0.8)];
    if (this.hist.length < 15) return;
    if (!this.closed && open < base * 0.62) this.closed = true;
    else if (this.closed && open > base * 0.8) {
      this.closed = false;
      this.blinks++;
    }
  }
  /** The usual openness, compared with a typical open eye (about 0.3). */
  get openness() {
    if (!this.hist.length) return 0.3;
    const s = [...this.hist].sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.8)];
  }
  get perMinute() {
    const secs = this.last - this.start;
    return secs > 5 ? (this.blinks / secs) * 60 : 0;
  }
}

/* ───────────────────────── the report ───────────────────────── */

export type RegionKey = "forehead" | "cheekL" | "cheekR" | "nose" | "eyeL" | "eyeR" | "lips" | "chin";

export type MetricKey = "heart" | "stress" | "water" | "tired" | "redness" | "shine" | "tone" | "smooth";

export type Metric = {
  key: MetricKey;
  label: string;
  value: string; // the headline, e.g. "72 bpm" or "Calm"
  level: number; // 0–100, higher = better for skin and body
  word: string; // a one or two word verdict
  tip: string; // one simple line on what to do
  where?: RegionKey[];
};

export type ScanReport = {
  score: number; // overall, 0–100
  metrics: Metric[];
  waterGlasses: number; // extra glasses suggested today
  confidence: "good" | "ok" | "low";
};

const word3 = (v: number, good: string, mid: string, low: string) => (v >= 70 ? good : v >= 45 ? mid : low);

/** Turns the raw readings into plain-language results. */
export function buildReport(r: {
  bpm: number | null;
  quality: number;
  rmssd: number | null;
  blinksPerMin: number;
  eyeOpen: number;
  regions: Partial<Record<RegionKey, Omit<PatchStats, "rgb" | "n"> | null>>;
}): ScanReport {
  const R = r.regions;
  const avg = (keys: RegionKey[], f: (p: Omit<PatchStats, "rgb" | "n">) => number) => {
    const v = keys.map((k) => R[k]).filter(Boolean) as Omit<PatchStats, "rgb" | "n">[];
    return v.length ? v.reduce((s, p) => s + f(p), 0) / v.length : NaN;
  };
  const cheeks: RegionKey[] = ["cheekL", "cheekR"];
  const skinAreas: RegionKey[] = ["forehead", "cheekL", "cheekR", "chin"];

  // redness: how red the cheeks and nose are, on their own and compared with the forehead
  const aCheek = avg([...cheeks, "nose"], (p) => p.a);
  const aRef = avg(["forehead", "chin"], (p) => p.a);
  const red = clamp01(0.55 * ((aCheek - 11) / 13) + 0.45 * ((aCheek - aRef + 1) / 6));
  // shine: bright, colourless highlights on the forehead and nose
  const shine = clamp01(avg(["forehead", "nose"], (p) => p.shine) / 0.05);
  // tone: dark marks and patchiness
  const spots = clamp01(avg(skinAreas, (p) => p.spots) / 0.09);
  const patchy = clamp01((avg(skinAreas, (p) => p.sd) - 3) / 7);
  const uneven = 0.65 * spots + 0.35 * patchy;
  // smoothness: fine texture on the cheeks
  const rough = clamp01((avg(cheeks, (p) => p.lap) - 5) / 14);
  const lipRough = clamp01((avg(["lips"], (p) => p.lap) - 6) / 16);
  const glow = clamp01(avg(cheeks, (p) => p.glow) / 0.22);
  // under-eye: darker than the cheek below it
  const eyeDark = clamp01((avg(cheeks, (p) => p.L) - avg(["eyeL", "eyeR"], (p) => p.L) - 3) / 14);

  const has = (v: number) => Number.isFinite(v);
  const water = 100 * (1 - clamp01(0.32 * rough + 0.24 * (has(lipRough) ? lipRough : rough) + 0.26 * (1 - glow) + 0.18 * uneven));
  const glasses = water >= 70 ? 0 : water >= 50 ? 2 : 3;

  // stress: faster heart and steadier (less variable) beats both point to stress
  const bpm = r.bpm;
  const hrPart = bpm ? clamp01((bpm - 62) / 40) : 0.4;
  const hrvPart = r.rmssd != null ? clamp01((55 - r.rmssd) / 40) : hrPart;
  const blinkPart = clamp01((r.blinksPerMin - 18) / 14);
  const stress = 100 * clamp01(0.5 * hrPart + 0.35 * hrvPart + 0.15 * blinkPart);
  const calm = 100 - stress;

  const tiredness = clamp01(0.6 * eyeDark + 0.4 * clamp01((0.28 - r.eyeOpen) / 0.1));
  const rested = 100 * (1 - tiredness);

  const metrics: Metric[] = [];
  if (bpm) {
    const ok = bpm >= 55 && bpm <= 95;
    metrics.push({
      key: "heart",
      label: "Heart rate",
      value: `${Math.round(bpm)} bpm`,
      level: ok ? 85 : 55,
      word: bpm < 55 ? "Low" : bpm <= 95 ? "Normal" : "Fast",
      tip: ok ? "A normal resting range is 60 to 100 beats a minute." : bpm > 95 ? "Sit and breathe slowly for a minute, then scan again." : "Normal if you're very fit. Scan again if you feel unwell.",
    });
  }
  metrics.push({
    key: "stress",
    label: "Stress",
    value: calm >= 70 ? "Calm" : calm >= 45 ? "A little" : "High",
    level: calm,
    word: word3(calm, "Calm", "Some stress", "Stressed"),
    tip: calm >= 70 ? "Your pulse looks relaxed. Nice." : "Try 5 slow breaths: in for 4, out for 6. Stress shows up in your skin too.",
  });
  metrics.push({
    key: "water",
    label: "Water",
    value: word3(water, "Well hydrated", "A bit thirsty", "Thirsty"),
    level: water,
    word: word3(water, "Good", "Drink more", "Drink more"),
    tip: glasses ? `Your skin and lips look a little dry. Drink ${glasses} more glasses of water today.` : "Your skin looks well hydrated. Keep drinking through the day.",
    where: ["cheekL", "cheekR", "lips"],
  });
  metrics.push({
    key: "tired",
    label: "Tired eyes",
    value: word3(rested, "Fresh", "A bit tired", "Tired"),
    level: rested,
    word: word3(rested, "Fresh", "A bit tired", "Tired"),
    tip: rested >= 70 ? "Your eyes look rested." : "Shadows under the eyes. Sleep 7 to 9 hours, and keep your head a little higher at night.",
    where: ["eyeL", "eyeR"],
  });
  const redL = 100 * (1 - red);
  metrics.push({
    key: "redness",
    label: "Redness",
    value: word3(redL, "Low", "Some", "High"),
    level: redL,
    word: word3(redL, "Calm skin", "Some redness", "Red"),
    tip: redL >= 70 ? "Your cheeks and nose look calm." : "Some redness on your cheeks or nose. Use gentle products and SPF 30 every day.",
    where: ["cheekL", "cheekR", "nose"],
  });
  const shineL = 100 * (1 - shine);
  metrics.push({
    key: "shine",
    label: "Oil & shine",
    value: word3(shineL, "Balanced", "Some shine", "Oily"),
    level: shineL,
    word: word3(shineL, "Balanced", "Some shine", "Oily"),
    tip: shineL >= 70 ? "Oil looks balanced." : "Shine on your T-zone. A light gel moisturiser and a gentle cleanser help.",
    where: ["forehead", "nose"],
  });
  const toneL = 100 * (1 - uneven);
  metrics.push({
    key: "tone",
    label: "Even tone",
    value: word3(toneL, "Even", "A few spots", "Uneven"),
    level: toneL,
    word: word3(toneL, "Even", "A few spots", "Uneven"),
    tip: toneL >= 70 ? "Your tone looks even." : "Some dark spots or patches. SPF every day stops them getting darker.",
    where: ["cheekL", "cheekR", "forehead"],
  });
  const smoothL = 100 * (1 - rough);
  metrics.push({
    key: "smooth",
    label: "Smoothness",
    value: word3(smoothL, "Smooth", "Some texture", "Rough"),
    level: smoothL,
    word: word3(smoothL, "Smooth", "Some texture", "Rough"),
    tip: smoothL >= 70 ? "Your skin surface looks smooth." : "Some texture or bumps. A gentle exfoliant twice a week can help.",
    where: ["cheekL", "cheekR"],
  });

  const skinParts = [water, rested, redL, shineL, toneL, smoothL];
  const score = Math.round(0.85 * (skinParts.reduce((s, v) => s + v, 0) / skinParts.length) + 0.15 * calm);
  const confidence = r.quality > 0.45 ? "good" : r.quality > 0.2 ? "ok" : "low";
  for (const m of metrics) m.level = Math.round(Math.max(4, Math.min(100, m.level)));
  return { score: Math.max(1, Math.min(99, score)), metrics, waterGlasses: glasses, confidence };
}
