"use client";
import { useEffect, useState } from "react";
import { CloudSun, Droplets, Flame, Snowflake, Sparkles, Sun, Thermometer, Wind } from "lucide-react";
import type { Forecast, TipKey } from "@/lib/skin-weather";
import { cn } from "@/lib/utils";

const ICON: Record<TipKey, typeof Sun> = { uv: Sun, dry: Droplets, cold: Snowflake, wind: Wind, chinook: Wind, heat: Thermometer, smoke: Flame, easy: Sparkles };
const TONE = { easy: "bg-sky-soft text-sky", care: "bg-amber-100 text-amber-800", protect: "bg-flora-soft text-flora" } as const;

/**
 * Today's skin forecast for Calgary: what the air is doing and what to do about it, in plain words.
 * If the weather can't be loaded the card simply doesn't show.
 */
export function SkinWeather({ className, compact }: { className?: string; compact?: boolean }) {
  const [f, setF] = useState<Forecast | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "off">("loading");
  useEffect(() => {
    let live = true;
    fetch("/api/skin-weather")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Forecast) => {
        if (!live) return;
        if (!d?.tips?.length) return setState("off");
        setF(d);
        setState("ok");
      })
      .catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, []);
  if (state === "off") return null;
  return (
    <section aria-label="Today's skin forecast for Calgary" className={cn("surface rounded-[28px] p-5 md:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] text-graphite">
          <CloudSun className="h-4 w-4 text-flora" /> Calgary skin forecast · today
        </p>
        {f && <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", TONE[f.level])}>{f.level === "easy" ? "Easy day" : f.level === "care" ? "Extra care" : "Protect"}</span>}
      </div>
      {!f ? (
        <div className="mt-4 space-y-3" aria-hidden>
          <div className="h-7 w-2/3 animate-pulse rounded-full bg-ink/[0.06]" />
          <div className="h-16 animate-pulse rounded-2xl bg-ink/[0.05]" />
        </div>
      ) : (
        <>
          <h3 className="mt-2 font-display text-[clamp(1.5rem,4.5vw,2rem)] leading-tight text-ink">{f.headline}</h3>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-graphite">
            <div className="flex gap-1.5">
              <dt>Now</dt>
              <dd className="tabular font-medium text-ink">
                {f.facts.temp}°{f.facts.feels !== f.facts.temp ? ` (feels ${f.facts.feels}°)` : ""}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Humidity</dt>
              <dd className="tabular font-medium text-ink">{f.facts.humidity}%</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>UV today</dt>
              <dd className="tabular font-medium text-ink">{f.facts.uv}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Wind</dt>
              <dd className="tabular font-medium text-ink">{f.facts.wind} km/h</dd>
            </div>
          </dl>
          <ul className={cn("mt-4 grid gap-2", !compact && "md:grid-cols-3")}>
            {f.tips.map((t) => {
              const I = ICON[t.key];
              return (
                <li key={t.key + t.title} className="flex gap-3 rounded-2xl border border-ink/[0.06] bg-white/70 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-flora-soft">
                    <I className="h-4 w-4 text-flora" />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-medium text-ink">{t.title}</span>
                    <span className="block text-[13.5px] leading-snug text-graphite">{t.tip}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
