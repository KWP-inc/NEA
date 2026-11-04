"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, Camera, Droplets, Eye, Flame, Gauge, HeartPulse, Loader2, Palette, RotateCcw, ShieldCheck, Sparkles, Sun, Waves, X } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useBooking } from "@/components/booking/booking";
import { useAi } from "@/components/ai/ai-provider";
import { cameraSupported, loadLandmarker, type Pt } from "@/lib/face-tracker";
import { BlinkCounter, PatchAverage, PulseMeter, buildReport, readPatch, type MetricKey, type RegionKey, type ScanReport } from "@/lib/skin-signals";
import { cn } from "@/lib/utils";

type Stage = "intro" | "loading" | "scan" | "result";
const SCAN_SECS = 20;
const WORK_W = 360; // the camera picture is read at this width (enough detail, fast on phones)

/** Landmarks (MediaPipe 468-point face) at the centre of each patch we read, and the patch size as a share of face height. */
const REGIONS: Record<RegionKey, { ids: number[]; size: number; oval: [number, number] }> = {
  forehead: { ids: [151, 108, 337], size: 0.075, oval: [0, -0.3] },
  cheekL: { ids: [50, 205, 187], size: 0.06, oval: [-0.25, 0.08] },
  cheekR: { ids: [280, 425, 411], size: 0.06, oval: [0.25, 0.08] },
  nose: { ids: [4, 5, 195], size: 0.03, oval: [0, 0.03] },
  eyeL: { ids: [230, 119, 228], size: 0.025, oval: [-0.17, -0.05] },
  eyeR: { ids: [450, 348, 448], size: 0.025, oval: [0.17, -0.05] },
  lips: { ids: [13, 14, 0, 17], size: 0.022, oval: [0, 0.24] },
  chin: { ids: [199, 175], size: 0.035, oval: [0, 0.37] },
};
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

/** What each live tag on the face shows, and where it sits. */
const TAGS: { key: MetricKey; at: RegionKey; label: string; from: number }[] = [
  { key: "heart", at: "forehead", label: "Pulse", from: 0.3 },
  { key: "water", at: "cheekR", label: "Water", from: 0.45 },
  { key: "tired", at: "eyeL", label: "Eyes", from: 0.55 },
  { key: "redness", at: "cheekL", label: "Redness", from: 0.65 },
  { key: "shine", at: "nose", label: "Shine", from: 0.75 },
  { key: "stress", at: "chin", label: "Stress", from: 0.85 },
];

const ICON: Record<MetricKey, typeof HeartPulse> = { heart: HeartPulse, stress: Gauge, water: Droplets, tired: Eye, redness: Flame, shine: Sun, tone: Palette, smooth: Waves };

type Live = { status: string; warn: boolean; progress: number; bpm: number | null; wave: number[]; report: ScanReport | null };
const EMPTY: Live = { status: "Finding your face…", warn: false, progress: 0, bpm: null, wave: [], report: null };

/**
 * NEA live face scan. Turn on the camera and, in 20 seconds, see your pulse, stress, water, tired eyes, redness, shine,
 * tone and smoothness drawn live on your own face. Everything runs on the phone: the camera picture is never sent or saved.
 * Open it from anywhere with openLiveScan().
 */
export function LiveScanHost() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("intro");
  const [error, setError] = useState("");
  const [live, setLive] = useState<Live>(EMPTY);
  const [result, setResult] = useState<{ report: ScanReport; photo: string; marks: Partial<Record<RegionKey, [number, number]>>; aspect: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopFns = useRef<(() => void)[]>([]);

  useEffect(() => {
    const on = () => {
      setStage("intro");
      setError("");
      setResult(null);
      setOpen(true);
    };
    window.addEventListener("nea:livescan", on);
    return () => window.removeEventListener("nea:livescan", on);
  }, []);

  const stopAll = useCallback(() => {
    stopFns.current.forEach((f) => f());
    stopFns.current = [];
  }, []);
  const close = useCallback(() => {
    stopAll();
    setOpen(false);
  }, [stopAll]);
  useEffect(() => stopAll, [stopAll]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const begin = async () => {
    setError("");
    if (!cameraSupported()) return setError("This browser can’t use the camera. Try Safari or Chrome on your phone.");
    setStage("loading");
    setLive(EMPTY);
    try {
      const v = video.current!;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30 } }, audio: false });
      stopFns.current.push(() => {
        stream.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      });
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play();
      // face tracking makes the readings follow your face; if it can't load, an oval guide does the same job
      const lm = await Promise.race([loadLandmarker().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 12000))]);
      setStage("scan");
      stopFns.current.push(run(lm));
    } catch (e) {
      stopAll();
      setStage("intro");
      setError((e as Error)?.name === "NotAllowedError" ? "Camera access was blocked. Allow the camera in your browser settings, then try again." : "The camera couldn’t start. Close other apps using it and try again.");
    }
  };

  /** The scan loop: read the face every frame, update the pulse and skin readings, draw the overlay. */
  const run = (lm: Awaited<ReturnType<typeof loadLandmarker>> | null) => {
    const v = video.current!;
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true })!;
    const pulse = new PulseMeter();
    const blinks = new BlinkCounter();
    const avg = Object.fromEntries(Object.keys(REGIONS).map((k) => [k, new PatchAverage()])) as Record<RegionKey, PatchAverage>;
    const accent = (getComputedStyle(document.documentElement).getPropertyValue("--c-warm") || "232 164 184").trim().split(/\s+/).join(",");
    let raf = 0;
    let lastT = -1;
    let lastFrame = performance.now();
    let progress = 0;
    let lastHud = 0;
    let lastNose: [number, number] | null = null;
    let lostFor = 0;
    let report: ScanReport | null = null;
    let reading: ReturnType<PulseMeter["read"]> = null;
    let frameNo = 0;
    let shot: { photo: string; marks: Partial<Record<RegionKey, [number, number]>>; aspect: number } | null = null;
    let done = false;
    const t0 = performance.now();

    const layout = () => {
      const W = c.clientWidth;
      const H = c.clientHeight;
      const s = Math.max(W / (v.videoWidth || 1), H / (v.videoHeight || 1));
      const dw = (v.videoWidth || 1) * s;
      const dh = (v.videoHeight || 1) * s;
      const ox = (W - dw) / 2;
      const oy = (H - dh) / 2;
      return { W, H, dw, dh, ox, oy, toScreen: (x: number, y: number) => [W - (ox + x * dw), oy + y * dh] as [number, number], toVideo: (sx: number, sy: number) => [(W - sx - ox) / dw, (sy - oy) / dh] as [number, number] };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (done || v.readyState < 2 || !v.videoWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(c.clientWidth * dpr) || c.height !== Math.round(c.clientHeight * dpr)) {
        c.width = Math.round(c.clientWidth * dpr);
        c.height = Math.round(c.clientHeight * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const L = layout();
      ctx.clearRect(0, 0, L.W, L.H);
      const fresh = v.currentTime !== lastT;
      lastT = v.currentTime;
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      const t = (now - t0) / 1000;

      // 1. where the face is: tracked landmarks, or the oval guide in the middle of the screen
      let pts: Pt[] | null = null;
      if (lm && fresh) {
        try {
          pts = lm.detectForVideo(v, now).faceLandmarks[0] ?? null;
        } catch {
          pts = null;
        }
      }
      const ovalScreen = { cx: L.W / 2, cy: L.H * 0.44, rx: Math.min(L.W * 0.34, L.H * 0.26), ry: Math.min(L.W * 0.34, L.H * 0.26) * 1.32 };
      let centers: Record<RegionKey, [number, number]>; // in video 0–1
      let faceH: number; // in video 0–1 of height
      if (lm) {
        if (!pts) {
          lostFor += dt;
          if (lostFor > 0.4) pulse.reset();
          hud(now, "Look straight at the camera", true);
          drawOvalGuide(ctx, ovalScreen, accent, t, 0.35);
          return;
        }
        lostFor = 0;
        const mean = (ids: number[]) => [ids.reduce((s, i) => s + pts![i].x, 0) / ids.length, ids.reduce((s, i) => s + pts![i].y, 0) / ids.length] as [number, number];
        centers = Object.fromEntries((Object.keys(REGIONS) as RegionKey[]).map((k) => [k, mean(REGIONS[k].ids)])) as Record<RegionKey, [number, number]>;
        faceH = Math.hypot(((pts[152].x - pts[10].x) * v.videoWidth) / v.videoHeight, pts[152].y - pts[10].y); // share of the picture's height
      } else {
        const [vx, vy] = L.toVideo(ovalScreen.cx, ovalScreen.cy);
        const fh = (ovalScreen.ry * 2) / L.dh;
        const fw = (ovalScreen.rx * 2) / L.dw;
        centers = Object.fromEntries((Object.keys(REGIONS) as RegionKey[]).map((k) => [k, [vx - REGIONS[k].oval[0] * fw, vy + REGIONS[k].oval[1] * fh]])) as Record<RegionKey, [number, number]>;
        faceH = fh;
      }

      // 2. read the skin
      if (!fresh) return draw(L, pts, centers, t);
      const ww = WORK_W;
      const wh = Math.round((WORK_W * v.videoHeight) / v.videoWidth);
      if (work.width !== ww) {
        work.width = ww;
        work.height = wh;
      }
      wctx.drawImage(v, 0, 0, ww, wh);
      const img = wctx.getImageData(0, 0, ww, wh).data;
      const read = (k: RegionKey) => readPatch(img, ww, wh, centers[k][0] * ww, centers[k][1] * wh, Math.max(3, REGIONS[k].size * faceH * wh));
      const fore = read("forehead");
      const cl = read("cheekL");
      const cr = read("cheekR");
      const skinParts = [fore, cl, cr].filter(Boolean) as NonNullable<typeof fore>[];
      frameNo++;

      // checks: face size, light, stillness
      let status = "";
      const nose = centers.nose;
      const move = lastNose ? Math.hypot(nose[0] - lastNose[0], nose[1] - lastNose[1]) / Math.max(0.05, faceH) : 0;
      lastNose = nose;
      const meanL = skinParts.length ? skinParts.reduce((s, p) => s + p.L, 0) / skinParts.length : 0;
      if (skinParts.length < 2) status = lm ? "Move into the light so we can see your skin" : "Fit your face inside the oval";
      else if (lm && faceH < 0.32) status = "Come a little closer";
      else if (meanL < 28) status = "Too dark. Face a window or a lamp";
      else if (meanL > 90) status = "Too bright. Step out of direct light";
      else if (move > 0.06) status = "Hold still";
      // uneven light is only a tip: the scan carries on
      const tip = !status && cl && cr && Math.abs(cl.L - cr.L) > 20 ? "Tip: turn so light falls evenly on your face" : "";

      if (!status && skinParts.length) {
        const n = skinParts.reduce((s, p) => s + p.n, 0);
        const rgb = [0, 1, 2].map((i) => skinParts.reduce((s, p) => s + p.rgb[i] * p.n, 0) / n) as [number, number, number];
        pulse.push(now / 1000, rgb);
        progress = Math.min(1, progress + dt / SCAN_SECS);
        if (pts) {
          const ear = (a: number, b: number, l: number, r: number) => Math.hypot(pts![a].x - pts![b].x, pts![a].y - pts![b].y) / Math.max(1e-4, Math.hypot(pts![l].x - pts![r].x, pts![l].y - pts![r].y));
          blinks.push(now / 1000, (ear(159, 145, 33, 133) + ear(386, 374, 362, 263)) / 2);
        }
        // skin readings: every 3rd frame once the picture has settled
        if (progress > 0.1 && frameNo % 3 === 0) {
          avg.forehead.add(fore);
          avg.cheekL.add(cl);
          avg.cheekR.add(cr);
          for (const k of ["nose", "eyeL", "eyeR", "lips", "chin"] as RegionKey[]) avg[k].add(read(k));
        }
        // keep a photo from the middle of the scan for the results page
        if (!shot && progress > 0.5) shot = snapshot(L, centers, faceH);
      } else if (move > 0.12) pulse.reset();

      // 3. the readings so far (every half second)
      const finished = progress >= 1;
      if (frameNo % 15 === 0 || finished) {
        reading = pulse.read();
        const bpm = reading && reading.quality > 0.15 && pulse.seconds > 7 ? reading.bpm : null;
        const hrv = bpm && progress > 0.6 ? pulse.beats(bpm) : null;
        report =
          progress > 0.25
            ? buildReport({ bpm, quality: reading?.quality ?? 0, rmssd: hrv?.rmssd ?? null, blinksPerMin: blinks.perMinute, eyeOpen: lm ? blinks.openness : 0.3, regions: Object.fromEntries((Object.keys(avg) as RegionKey[]).map((k) => [k, avg[k].get()])) })
            : null;
      }

      draw(L, pts, centers, t);
      hud(now, status || tip || (progress < 0.25 ? "Hold still. Reading your pulse…" : progress < 0.6 ? "Reading water, redness and shine…" : progress < 0.95 ? "Checking stress and tired eyes…" : "Almost done…"), Boolean(status));

      if (finished && report) {
        done = true;
        const s = shot ?? snapshot(L, centers, faceH);
        stopAll();
        setResult({ report, ...s });
        setStage("result");
      }
    };

    /** A mirrored photo cropped to the face (no overlay), plus where each region sits on it (0–1). */
    const snapshot = (L: ReturnType<typeof layout>, centers: Record<RegionKey, [number, number]>, faceH: number) => {
      const k = Math.min(2, 1100 / Math.max(L.W, L.H));
      const full = document.createElement("canvas");
      full.width = Math.round(L.W * k);
      full.height = Math.round(L.H * k);
      const g = full.getContext("2d")!;
      g.scale(-k, k);
      g.drawImage(v, -(L.W - L.ox), L.oy, L.dw, L.dh);
      // a 4:5 portrait around the face
      const [nx, ny] = L.toScreen(centers.nose[0], centers.nose[1]);
      const fh = faceH * L.dh;
      const ch = Math.min(L.H, fh * 1.8);
      const cw = Math.min(L.W, ch * 0.8);
      const cx = Math.max(0, Math.min(L.W - cw, nx - cw / 2));
      const cy = Math.max(0, Math.min(L.H - ch, ny - ch * 0.5));
      const out = document.createElement("canvas");
      out.width = Math.round(cw * k);
      out.height = Math.round(ch * k);
      out.getContext("2d")!.drawImage(full, cx * k, cy * k, cw * k, ch * k, 0, 0, out.width, out.height);
      const marks = Object.fromEntries((Object.keys(centers) as RegionKey[]).map((r) => {
        const [sx, sy] = L.toScreen(centers[r][0], centers[r][1]);
        return [r, [(sx - cx) / cw, (sy - cy) / ch]];
      })) as Partial<Record<RegionKey, [number, number]>>;
      return { photo: out.toDataURL("image/jpeg", 0.88), marks, aspect: cw / ch };
    };

    const draw = (L: ReturnType<typeof layout>, pts: Pt[] | null, centers: Record<RegionKey, [number, number]>, t: number) => {
      if (pts) {
        // a soft outline of the face
        ctx.beginPath();
        FACE_OVAL.forEach((i, j) => {
          const [x, y] = L.toScreen(pts[i].x, pts[i].y);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = `rgba(${accent},0.85)`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = `rgba(${accent},0.9)`;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // a light sweeping down the face while scanning
        const ys = FACE_OVAL.map((i) => L.toScreen(pts[i].x, pts[i].y)[1]);
        const top = Math.min(...ys);
        const bot = Math.max(...ys);
        const sy = top + ((Math.sin(t * 1.4) + 1) / 2) * (bot - top);
        ctx.save();
        ctx.clip();
        const g = ctx.createLinearGradient(0, sy - 40, 0, sy + 4);
        g.addColorStop(0, `rgba(${accent},0)`);
        g.addColorStop(1, `rgba(${accent},0.28)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, sy - 40, L.W, 44);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(0, sy, L.W, 1.2);
        ctx.restore();
      } else {
        const r = Math.min(L.W * 0.34, L.H * 0.26);
        drawOvalGuide(ctx, { cx: L.W / 2, cy: L.H * 0.44, rx: r, ry: r * 1.32 }, accent, t, 1);
      }
      // the reading points, and a live tag for each result as it comes in
      const scale = Math.min(1, L.W / 420);
      for (const k of Object.keys(centers) as RegionKey[]) {
        const [x, y] = L.toScreen(centers[k][0], centers[k][1]);
        const p = 1 + Math.sin(t * 3 + x * 0.05) * 0.3;
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.arc(x, y, 7 * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const tag of TAGS) {
        if (progress < tag.from) continue;
        const m = tag.key === "heart" ? null : report?.metrics.find((x) => x.key === tag.key);
        const bpm = reading && reading.quality > 0.15 && pulse.seconds > 7 ? Math.round(reading.bpm) : null;
        const text = tag.key === "heart" ? (bpm ? `♥ ${bpm} bpm` : "♥ reading…") : m ? `${tag.label} · ${m.value}` : `${tag.label} · …`;
        const [x, y] = L.toScreen(centers[tag.at][0], centers[tag.at][1]);
        const right = x > L.W / 2;
        ctx.font = `600 ${Math.round(12.5 * Math.max(0.85, scale))}px Inter, system-ui, sans-serif`;
        const tw = ctx.measureText(text).width;
        const bw = tw + 20;
        let bx = right ? x + 14 : x - 14 - bw;
        bx = Math.max(6, Math.min(L.W - bw - 6, bx));
        const by = y - 13;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(right ? bx : bx + bw, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, 26, 13);
        ctx.fill();
        ctx.fillStyle = "#1f1a24";
        ctx.fillText(text, bx + 10, by + 17.5);
      }
    };

    const hud = (now: number, status: string, warn: boolean) => {
      if (now - lastHud < 200) return;
      lastHud = now;
      const bpm = reading && reading.quality > 0.15 && pulse.seconds > 7 ? reading.bpm : null;
      setLive({ status, warn, progress, bpm, wave: reading?.wave ?? [], report });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  };

  const again = () => {
    setResult(null);
    begin();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[96] bg-[#120d10] text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent role="dialog" aria-modal="true" aria-label="NEA live skin scan">
          <video ref={video} className={cn("absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity duration-500", stage === "scan" ? "opacity-100" : "opacity-0")} playsInline muted />
          <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70", stage === "scan" ? "opacity-100" : "opacity-0")} />
          <canvas ref={canvas} className={cn("absolute inset-0 h-full w-full", stage === "scan" ? "block" : "invisible")} />

          {/* top bar */}
          <div className={cn("absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6", stage === "result" && "border-b border-ink/[0.06] bg-porcelain/90 !py-3 text-ink backdrop-blur-md")}>
            <p className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] backdrop-blur-md", stage === "result" ? "bg-ink/[0.05]" : "bg-black/40")}>
              <NeaSiIcon className="h-4 w-4" /> NEA live skin scan
            </p>
            <button onClick={close} aria-label="Close" className={cn("grid h-10 w-10 place-items-center rounded-full backdrop-blur-md", stage === "result" ? "bg-ink/[0.06] hover:bg-ink/10" : "bg-white/15 hover:bg-white/25")}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {(stage === "intro" || stage === "loading") && <Intro loading={stage === "loading"} error={error} onStart={begin} />}
          {stage === "scan" && <Hud live={live} />}
          {stage === "result" && result && <Results data={result} onAgain={again} onClose={close} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function drawOvalGuide(ctx: CanvasRenderingContext2D, o: { cx: number; cy: number; rx: number; ry: number }, accent: string, t: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -t * 12;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.6;
  ctx.shadowColor = `rgba(${accent},0.9)`;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const MEASURES: { icon: typeof HeartPulse; label: string }[] = [
  { icon: HeartPulse, label: "Heart rate" },
  { icon: Gauge, label: "Stress" },
  { icon: Droplets, label: "Water" },
  { icon: Eye, label: "Tired eyes" },
  { icon: Flame, label: "Redness" },
  { icon: Sun, label: "Oil & shine" },
  { icon: Palette, label: "Even tone" },
  { icon: Waves, label: "Smoothness" },
];

function Intro({ loading, error, onStart }: { loading: boolean; error: string; onStart: () => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" data-lenis-prevent>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_30%,rgb(var(--c-warm)/0.35),transparent_70%)]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-5 pb-8 pt-20">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Free · 20 seconds · on your phone</p>
        <h2 className="mt-2 font-display text-[clamp(2.1rem,8vw,2.8rem)] leading-[1.02]">Scan your face. See what your skin says.</h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-white/75">Turn on your camera and hold still. Nea SI reads your pulse and your skin, and shows the results right on your face.</p>
        <ul className="mt-5 grid grid-cols-2 gap-2">
          {MEASURES.map(({ icon: I, label }) => (
            <li key={label} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-[14px]">
              <I className="h-4 w-4 shrink-0 text-dermis" /> {label}
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-2xl bg-white/[0.06] p-3.5 text-[13.5px] leading-snug text-white/75">
          <p className="font-semibold text-white">For a good reading</p>
          <p className="mt-1">Face a window or a lamp · no filter · hair off your face · hold your phone still at eye level.</p>
        </div>
        <button onClick={onStart} disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-[16px] font-semibold text-ink transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-70">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {loading ? "Starting camera…" : "Start my scan"}
        </button>
        {error && <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-[13.5px] text-red-100">{error}</p>}
        <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-[12px] leading-snug text-white/55">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" /> Everything stays on your phone. Your camera is never recorded, saved or sent.
        </p>
      </motion.div>
    </div>
  );
}

function Hud({ live }: { live: Live }) {
  const left = Math.max(0, Math.ceil(SCAN_SECS * (1 - live.progress)));
  const wave = live.wave.length > 2 ? live.wave : null;
  const path = wave ? wave.map((v, i) => `${i ? "L" : "M"}${((i / (wave.length - 1)) * 200).toFixed(1)},${(22 - v * 18).toFixed(1)}`).join(" ") : "";
  const chips: MetricKey[] = ["stress", "water", "tired", "redness", "shine", "tone"];
  return (
    <>
      <div className="absolute inset-x-0 top-[4.25rem] z-10 flex justify-center px-4">
        <AnimatePresence mode="wait">
          <motion.p key={live.status} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("rounded-full px-4 py-2 text-center text-[14px] font-medium backdrop-blur-md", live.warn ? "bg-amber-400/90 text-ink" : "bg-black/50 text-white")} role="status" aria-live="polite">
            {live.status}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-lg rounded-[26px] border border-white/15 bg-black/55 p-4 backdrop-blur-xl sm:bottom-6">
        <div className="flex items-center justify-between text-[12.5px] text-white/70">
          <span>Scanning</span>
          <span className="tabular">{left}s left</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-dermis to-white transition-[width] duration-200" style={{ width: `${live.progress * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <motion.span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10" animate={live.bpm ? { scale: [1, 1.14, 1] } : undefined} transition={live.bpm ? { duration: 60 / live.bpm, repeat: Infinity } : undefined}>
            <HeartPulse className="h-5 w-5 text-dermis" />
          </motion.span>
          <div className="w-24 shrink-0">
            <p className="tabular font-display text-[1.75rem] leading-none">{live.bpm ? Math.round(live.bpm) : "--"}</p>
            <p className="text-[11.5px] text-white/60">beats a minute</p>
          </div>
          <svg viewBox="0 0 200 44" className="h-11 min-w-0 flex-1" preserveAspectRatio="none" aria-hidden>
            {path ? <path d={path} fill="none" stroke="rgb(var(--c-warm))" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : <line x1="0" y1="22" x2="200" y2="22" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 5" />}
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {chips.map((k) => {
            const m = live.report?.metrics.find((x) => x.key === k);
            const I = ICON[k];
            return (
              <div key={k} className="rounded-xl bg-white/[0.07] px-2 py-1.5">
                <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-white/55">
                  <I className="h-3 w-3" /> {k === "tired" ? "Eyes" : k === "tone" ? "Tone" : k === "shine" ? "Shine" : k[0].toUpperCase() + k.slice(1)}
                </p>
                <p className="truncate text-[13px] font-medium">{m ? m.value : "…"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Results({ data, onAgain, onClose }: { data: { report: ScanReport; photo: string; marks: Partial<Record<RegionKey, [number, number]>>; aspect: number }; onAgain: () => void; onClose: () => void }) {
  const { report, photo, marks, aspect } = data;
  const [hot, setHot] = useState<MetricKey | null>(null);
  const book = useBooking();
  const ai = useAi();
  const focus = report.metrics.filter((m) => m.key !== "heart" && m.key !== "stress").sort((a, b) => a.level - b.level)[0];
  const ask = `My NEA live face scan: ${report.metrics.map((m) => `${m.label} ${m.value}`).join(", ")}. Skin score ${report.score}/100. What should I do first?`;
  const hotWhere = report.metrics.find((m) => m.key === hot)?.where ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 overflow-y-auto bg-porcelain text-ink" data-lenis-prevent>
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-[5.5rem] md:px-8">
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:gap-10">
          {/* the photo, with the areas we read */}
          <div>
            <div className="relative mx-auto max-h-[62svh] overflow-hidden rounded-[26px] bg-ink" style={{ aspectRatio: String(aspect) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your face from the scan, with the areas Nea SI read" className="h-full w-full object-cover" />
              {(Object.keys(marks) as RegionKey[]).map((r) => {
                const on = hotWhere.includes(r);
                const [x, y] = marks[r]!;
                return (
                  <span key={r} aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
                    <span className={cn("block rounded-full border-2 border-white transition-all", on ? "h-9 w-9 bg-white/30 shadow-[0_0_0_6px_rgba(255,255,255,0.25)]" : "h-3 w-3 bg-white/70")} />
                  </span>
                );
              })}
              <div className="absolute bottom-3 left-3 rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-lg">
                <p className="text-[11px] uppercase tracking-[0.14em] text-graphite">Skin score</p>
                <p className="tabular font-display text-[2rem] leading-none">
                  {report.score}
                  <span className="text-[14px] text-graphite">/100</span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[12px] text-graphite">Tap a result to see where we read it.</p>
          </div>

          {/* the results */}
          <div>
            <p className="flex items-center gap-2 text-[13px] text-flora">
              <NeaSiIcon className="h-4 w-4" /> Your live scan results
            </p>
            <h2 className="mt-1.5 font-display text-[clamp(1.9rem,6vw,2.6rem)] leading-[1.04]">{report.score >= 75 ? "Your skin looks happy." : report.score >= 55 ? "Good, with a few things to fix." : "Your skin is asking for help."}</h2>
            {focus && focus.level < 70 ? (
              <p className="mt-2 text-[15.5px] leading-relaxed text-graphite">
                Start with <strong className="font-semibold text-ink">{focus.label.toLowerCase()}</strong>. {focus.tip}
              </p>
            ) : (
              <p className="mt-2 text-[15.5px] leading-relaxed text-graphite">Everything looks good. Keep up your routine, drink water and wear SPF every day.</p>
            )}
            {report.confidence === "low" && <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-[13px] text-amber-900">The light or movement made the pulse hard to read. For a sharper result, scan again facing a window and hold very still.</p>}

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {report.metrics.map((m, i) => {
                const I = ICON[m.key];
                const good = m.level >= 70;
                return (
                  <motion.li key={m.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <button onClick={() => setHot(hot === m.key ? null : m.key)} className={cn("h-full w-full rounded-2xl border p-3.5 text-left transition", hot === m.key ? "border-flora/40 bg-white shadow-sm" : "border-ink/[0.07] bg-white/70")} aria-pressed={hot === m.key}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13px] text-graphite">
                          <I className="h-4 w-4 text-flora" /> {m.label}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-medium", good ? "bg-sky-soft text-sky" : m.level >= 45 ? "bg-amber-100 text-amber-800" : "bg-flora-soft text-flora")}>{m.word}</span>
                      </span>
                      <span className="mt-1 block font-display text-[1.45rem] leading-tight">{m.value}</span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                        <motion.span className="block h-full rounded-full" style={{ background: "linear-gradient(90deg, rgb(var(--viz-1)), rgb(var(--viz-2)))" }} initial={{ width: 0 }} animate={{ width: `${m.level}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }} />
                      </span>
                      <span className="mt-2 block text-[13.5px] leading-snug text-graphite">{m.tip}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>

            <WaterGoal extra={report.waterGlasses} />

            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <button onClick={() => (onClose(), book.open("skin-scan", "Free skin scan"))} className="btn-primary justify-center">
                <CalendarHeart className="h-4 w-4" /> Book my free in-clinic scan
              </button>
              <button onClick={() => (onClose(), ai.open({ context: "Live face scan result", query: ask }))} className="btn-ghost justify-center">
                <NeaSiIcon className="h-4 w-4" /> Ask Nea SI what to do
              </button>
              <button onClick={onAgain} className="btn-ghost justify-center">
                <RotateCcw className="h-4 w-4" /> Scan again
              </button>
            </div>
            <p className="mt-4 flex gap-2 text-[12.5px] leading-snug text-graphite">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flora" />
              A phone camera gives a quick guide, not a medical test. The free in-clinic scan sees 8 kinds of light, hidden sun damage and your skin age.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** A simple water goal for today: tap a glass each time you drink. Remembered on this phone for the day. */
function WaterGoal({ extra }: { extra: number }) {
  const goal = 8;
  const key = `nea-water-${new Date().toISOString().slice(0, 10)}`;
  const [had, setHad] = useState(0);
  useEffect(() => {
    try {
      setHad(Number(localStorage.getItem(key)) || 0);
    } catch {
      /* private mode: start at 0 */
    }
  }, [key]);
  const set = (n: number) => {
    setHad(n);
    try {
      localStorage.setItem(key, String(n));
    } catch {
      /* fine */
    }
  };
  return (
    <div className="mt-4 rounded-2xl border border-sky/20 bg-sky-soft p-4">
      <p className="flex items-center gap-2 text-[14.5px] font-medium">
        <Droplets className="h-4 w-4 text-sky" /> Today’s water: {had} of {goal} glasses
      </p>
      <p className="mt-0.5 text-[13px] text-graphite">{extra ? `Your skin looks a bit thirsty, so aim for ${extra} extra glasses today. ` : ""}Tap a glass each time you drink one.</p>
      <div className="mt-3 grid max-w-sm grid-cols-8 gap-1.5">
        {Array.from({ length: goal }, (_, i) => (
          <button key={i} onClick={() => set(had === i + 1 ? i : i + 1)} aria-label={`${i + 1} glasses`} aria-pressed={i < had} className={cn("grid h-10 place-items-center rounded-lg border transition", i < had ? "border-sky bg-sky text-white" : "border-sky/30 bg-white text-sky/50")}>
            <Droplets className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
