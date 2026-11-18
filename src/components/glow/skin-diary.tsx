"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookHeart, CalendarHeart, Camera, Minus, ShieldCheck, Trash2, TrendingUp } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useAi } from "@/components/ai/ai-provider";
import { useBooking } from "@/components/booking/booking";
import { openLiveScan } from "@/components/scan/open-live-scan";
import { KEYS, useStored, type DiaryEntry } from "@/lib/glow-store";
import { shortDate } from "@/lib/ics";
import { cn } from "@/lib/utils";

const SERIES: { key: string; label: string }[] = [
  { key: "score", label: "Skin score" },
  { key: "water", label: "Water" },
  { key: "redness", label: "Redness" },
  { key: "shine", label: "Oil & shine" },
  { key: "tone", label: "Even tone" },
  { key: "smooth", label: "Smoothness" },
  { key: "tired", label: "Tired eyes" },
  { key: "stress", label: "Calm" },
];
const valueOf = (e: DiaryEntry, key: string) => (key === "score" ? e.score : e.metrics.find((m) => m.key === key)?.level);
const daysBetween = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000);

/**
 * Skin Diary: every live face scan, saved to the member's account (numbers only; photos stay on the phone). Shows how the skin score and each reading
 * change over time, a before-and-after of the first and latest photo, and the full history.
 */
export function SkinDiary() {
  const [entries, setEntries, ready] = useStored<DiaryEntry[]>(KEYS.diary, []);
  const [series, setSeries] = useState("score");
  const [pick, setPick] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const ai = useAi();
  const book = useBooking();

  const first = entries[0];
  const last = entries[entries.length - 1];
  const points = useMemo(() => entries.map((e) => ({ e, v: valueOf(e, series) })).filter((p): p is { e: DiaryEntry; v: number } => typeof p.v === "number"), [entries, series]);
  const selected = entries.find((e) => e.id === pick) ?? last;

  if (!ready) return <div className="surface h-64 animate-pulse rounded-[32px]" aria-hidden />;

  if (!entries.length) {
    return (
      <div className="surface rounded-[32px] p-6 text-center md:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-flora-soft">
          <BookHeart className="h-7 w-7 text-flora" />
        </span>
        <h2 className="mt-4 font-display text-[clamp(1.8rem,5vw,2.6rem)] leading-tight text-ink">Your diary starts with one scan.</h2>
        <p className="mx-auto mt-2 max-w-md text-[16px] leading-relaxed text-graphite">Scan your face for 20 seconds. We save your skin score to your account. Scan again next week and watch it change.</p>
        <ol className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-3">
          {["Scan your face with your camera.", "Your score is saved to your account. The photo stays on this phone.", "Come back each week to see your trend."].map((t, i) => (
            <li key={t} className="flex gap-3 rounded-2xl border border-ink/[0.06] bg-white/70 p-3.5 text-[14.5px] text-ink">
              <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flora-soft text-[12px] text-flora">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <button onClick={openLiveScan} className="btn-light mx-auto mt-6 !px-7 !py-4 !text-[16px]">
          <Camera className="h-5 w-5" /> Scan my face now
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-graphite">
          <ShieldCheck className="h-3.5 w-3.5" /> Private. Your diary never leaves this phone.
        </p>
      </div>
    );
  }

  const change = last.score - first.score;
  const sinceLast = daysBetween(new Date(last.at), new Date());
  const nextIn = Math.max(0, 7 - sinceLast);
  const remove = (id: string) => setEntries((list) => list.filter((e) => e.id !== id));
  const ask = `My NEA Skin Diary has ${entries.length} scans. First skin score ${first.score}, latest ${last.score}. Latest readings: ${last.metrics.map((m) => `${m.label} ${m.value}`).join(", ")}. What should I work on next?`;

  return (
    <div className="space-y-5">
      {/* headline numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Latest skin score" value={`${last.score}`} unit="/100" note={shortDate(new Date(last.at))} />
        <Stat
          label={entries.length > 1 ? "Change since your first scan" : "Scans so far"}
          value={entries.length > 1 ? `${change > 0 ? "+" : ""}${change}` : "1"}
          note={entries.length > 1 ? `${entries.length} scans over ${Math.max(1, daysBetween(new Date(first.at), new Date(last.at)))} days` : "Scan again to see a change"}
          good={entries.length > 1 ? change >= 0 : undefined}
        />
        <div className="surface flex flex-col justify-between rounded-[24px] p-5">
          <p className="text-[13px] text-graphite">Next scan</p>
          <p className="mt-1 font-display text-[1.7rem] leading-tight text-ink">{nextIn === 0 ? "Today" : `In ${nextIn} day${nextIn === 1 ? "" : "s"}`}</p>
          <button onClick={openLiveScan} className="btn-light mt-3 w-full !py-2.5 !text-[14.5px]">
            <Camera className="h-4 w-4" /> Scan now
          </button>
        </div>
      </div>

      {/* trend */}
      <section className="surface rounded-[28px] p-5 md:p-7" aria-label="Trend">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-[1.6rem] text-ink">
            <TrendingUp className="h-5 w-5 text-flora" /> Your trend
          </h2>
          <p className="text-[12.5px] text-graphite">Higher is better.</p>
        </div>
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="What to show">
          {SERIES.map((s) => (
            <button key={s.key} role="tab" aria-selected={series === s.key} onClick={() => setSeries(s.key)} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-[13.5px] transition", series === s.key ? "border-ink bg-ink text-white" : "border-ink/10 bg-white/70 text-ink hover:border-ink/25")}>
              {s.label}
            </button>
          ))}
        </div>
        <Trend points={points} picked={selected?.id} onPick={setPick} label={SERIES.find((s) => s.key === series)!.label} />
        {points.length < 2 && <p className="mt-2 text-center text-[13.5px] text-graphite">One scan so far. Your line appears after your second scan.</p>}
      </section>

      {/* before and after */}
      {first.photo && last.photo && first.id !== last.id && <Compare a={first} b={last} />}

      {/* history */}
      <section className="surface rounded-[28px] p-5 md:p-7" aria-label="All scans">
        <h2 className="font-display text-[1.6rem] text-ink">Every scan</h2>
        <ul className="mt-4 space-y-2">
          {[...entries].reverse().map((e, i, arr) => {
            const prev = arr[i + 1];
            const d = prev ? e.score - prev.score : null;
            return (
              <li key={e.id} className={cn("flex items-center gap-3 rounded-2xl border p-3 transition", selected?.id === e.id ? "border-flora/40 bg-white" : "border-ink/[0.06] bg-white/60")}>
                <button onClick={() => setPick(e.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Show scan from ${shortDate(new Date(e.at))}`}>
                  {e.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photo} alt="" className="h-14 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-14 w-11 shrink-0 place-items-center rounded-xl bg-mist text-graphite">
                      <Camera className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{new Date(e.at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    <span className="block truncate text-[13px] text-graphite">
                      {e.metrics
                        .filter((m) => m.key !== "heart")
                        .sort((a, b) => a.level - b.level)
                        .slice(0, 2)
                        .map((m) => `${m.label}: ${m.value}`)
                        .join(" · ")}
                      {e.bpm ? ` · ${e.bpm} bpm` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block font-display text-[1.5rem] leading-none text-ink">{e.score}</span>
                    {d != null && <span className={cn("tabular text-[12px]", d > 0 ? "text-sky" : d < 0 ? "text-flora" : "text-graphite")}>{d > 0 ? `+${d}` : d === 0 ? "same" : d}</span>}
                  </span>
                </button>
                <button onClick={() => remove(e.id)} aria-label={`Delete scan from ${shortDate(new Date(e.at))}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-graphite hover:bg-ink/[0.05] hover:text-ink">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        {selected && (
          <div className="mt-5 rounded-2xl bg-mist/70 p-4">
            <p className="text-[13px] text-graphite">Readings on {shortDate(new Date(selected.at))}</p>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {selected.metrics.map((m) => (
                <li key={m.key} className="text-[14px]">
                  <span className="flex justify-between gap-2">
                    <span className="text-graphite">{m.label}</span>
                    <span className="font-medium text-ink">{m.value}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <span className="block h-full rounded-full" style={{ width: `${m.level}%`, background: "linear-gradient(90deg, rgb(var(--viz-1)), rgb(var(--viz-2)))" }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button onClick={() => book.open("skin-scan", "Free skin scan")} className="btn-primary justify-center">
          <CalendarHeart className="h-4 w-4" /> Book my free in-clinic scan
        </button>
        <button onClick={() => ai.open({ context: "Skin Diary", query: ask })} className="btn-ghost justify-center">
          <NeaSiIcon className="h-4 w-4" /> Ask Nea SI about my trend
        </button>
        {confirmAll ? (
          <span className="flex items-center gap-2 rounded-full border border-flora/30 bg-white px-4 py-2 text-[14px]">
            Delete every scan?
            <button onClick={() => (setEntries([]), setConfirmAll(false))} className="font-semibold text-flora underline-offset-4 hover:underline">
              Yes, delete
            </button>
            <button onClick={() => setConfirmAll(false)} className="text-graphite underline-offset-4 hover:underline">
              Keep
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmAll(true)} className="btn-ghost justify-center">
            <Trash2 className="h-4 w-4" /> Delete my diary
          </button>
        )}
      </div>
      <p className="flex gap-2 text-[12.5px] leading-snug text-graphite">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Your scores are saved to your free account. Photos stay on this phone only and are never sent to NEA. A phone camera gives a guide, not a medical test, and light changes the numbers, so scan in the same spot each time.
      </p>
    </div>
  );
}

function Stat({ label, value, unit, note, good }: { label: string; value: string; unit?: string; note?: string; good?: boolean }) {
  return (
    <div className="surface rounded-[24px] p-5">
      <p className="text-[13px] text-graphite">{label}</p>
      <p className={cn("tabular mt-1 font-display text-[2.6rem] leading-none", good === undefined ? "text-ink" : good ? "text-sky" : "text-flora")}>
        {value}
        {unit && <span className="text-[1rem] text-graphite">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-[13px] text-graphite">{note}</p>}
    </div>
  );
}

/** A simple line chart, 0 to 100. Tap a point to see that scan. */
function Trend({ points, picked, onPick, label }: { points: { e: DiaryEntry; v: number }[]; picked?: string; onPick: (id: string) => void; label: string }) {
  // the chart is drawn at the real width of its box, so the numbers stay readable on a phone
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setW(Math.max(260, Math.round(el.clientWidth)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220;
  const pad = { l: 30, r: 14, t: 22, b: 30 };
  const x = (i: number) => (points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z` : "";
  const sel = points.find((p) => p.e.id === picked) ?? points[points.length - 1];
  return (
    <div className="mt-4" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label} over ${points.length} scans${sel ? `. Selected: ${sel.v} on ${shortDate(new Date(sel.e.at))}` : ""}`}>
        <defs>
          <linearGradient id="diary-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--viz-1))" stopOpacity="0.28" />
            <stop offset="1" stopColor="rgb(var(--viz-1))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="rgb(var(--c-ink))" strokeOpacity={g === 0 ? 0.18 : 0.07} />
            <text x={pad.l - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--c-graphite))">
              {g}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="url(#diary-fill)" />}
        {points.length > 1 && <motion.path d={line} fill="none" stroke="rgb(var(--viz-1))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} key={label} />}
        {points.map((p, i) => {
          const on = sel?.e.id === p.e.id;
          return (
            <g key={p.e.id} onClick={() => onPick(p.e.id)} className="cursor-pointer">
              <circle cx={x(i)} cy={y(p.v)} r="16" fill="transparent" />
              <circle cx={x(i)} cy={y(p.v)} r={on ? 6.5 : 4} fill={on ? "rgb(var(--viz-1))" : "#fff"} stroke="rgb(var(--viz-1))" strokeWidth="2.5" />
            </g>
          );
        })}
        {sel && (
          <text x={Math.min(W - pad.r - 4, Math.max(pad.l + 4, x(points.indexOf(sel))))} y={Math.max(12, y(sel.v) - 12)} textAnchor="middle" fontSize="13" fontWeight="600" fill="rgb(var(--c-ink))">
            {sel.v}
          </text>
        )}
        {points.length > 0 && (
          <>
            <text x={pad.l} y={H - 8} fontSize="11" fill="rgb(var(--c-graphite))">
              {shortDate(new Date(points[0].e.at))}
            </text>
            {points.length > 1 && (
              <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize="11" fill="rgb(var(--c-graphite))">
                {shortDate(new Date(points[points.length - 1].e.at))}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

/** First photo against the latest, with a slider to wipe between them. */
function Compare({ a, b }: { a: DiaryEntry; b: DiaryEntry }) {
  const [pos, setPos] = useState(50);
  const d = b.score - a.score;
  return (
    <section className="surface rounded-[28px] p-5 md:p-7" aria-label="Before and after">
      <div className="grid items-center gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-[22px] bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.photo} alt={`Your face on ${shortDate(new Date(b.at))}`} className="absolute inset-0 h-full w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.photo} alt={`Your face on ${shortDate(new Date(a.at))}`} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }} />
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] text-white">First</span>
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] text-ink">Latest</span>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Slide between your first and latest photo" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
        </div>
        <div>
          <h2 className="font-display text-[1.6rem] text-ink">First scan and latest scan</h2>
          <p className="mt-1 text-[15px] text-graphite">Slide across the photo to compare.</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-2xl bg-mist/70 p-3">
              <p className="text-[12px] text-graphite">{shortDate(new Date(a.at))}</p>
              <p className="tabular font-display text-[2rem] leading-none text-ink">{a.score}</p>
            </div>
            <span className={cn("tabular flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-medium", d > 0 ? "bg-sky-soft text-sky" : d < 0 ? "bg-flora-soft text-flora" : "bg-ink/[0.06] text-ink")}>{d > 0 ? `+${d}` : d === 0 ? <Minus className="h-4 w-4" /> : d}</span>
            <div className="rounded-2xl bg-mist/70 p-3">
              <p className="text-[12px] text-graphite">{shortDate(new Date(b.at))}</p>
              <p className="tabular font-display text-[2rem] leading-none text-ink">{b.score}</p>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-graphite">Photos are small copies kept on this phone only. They are never sent to NEA. Different light can change how they look.</p>
        </div>
      </div>
    </section>
  );
}
