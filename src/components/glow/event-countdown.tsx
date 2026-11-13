"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, CalendarHeart, Check, ShieldCheck, Sparkles, X } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useAi } from "@/components/ai/ai-provider";
import { useBooking } from "@/components/booking/booking";
import { EVENT_LABEL, EVENT_NOUN, GOAL_LABEL, buildPlan, parseDay, type EventType, type Goal } from "@/lib/event-plan";
import { KEYS, award, dayKey, useStored } from "@/lib/glow-store";
import { downloadIcs, longDate, shortDate } from "@/lib/ics";
import { cn } from "@/lib/utils";

type Saved = { type: EventType; date: string; goals: Goal[] };
const QUICK: [string, number][] = [
  ["In 1 month", 30],
  ["In 3 months", 91],
  ["In 6 months", 182],
  ["In 1 year", 365],
];
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/**
 * Event Countdown. Pick the day and what you want, and get a week-by-week skin plan that is safe for the time left:
 * what to do now, what to book when, and what to skip because it is too close. Saved on this phone.
 */
export function EventCountdown() {
  const [saved, setSaved, ready] = useStored<Saved>(KEYS.event, { type: "wedding", date: "", goals: ["glow"] });
  const [today, setToday] = useState<Date | null>(null);
  const ai = useAi();
  const book = useBooking();
  useEffect(() => setToday(new Date()), []);

  const valid = Boolean(saved.date) && today != null && parseDay(saved.date).getTime() > today.getTime() - 86400000;
  const plan = useMemo(() => (valid && today ? buildPlan(parseDay(saved.date), saved.goals, today) : null), [valid, saved.date, saved.goals, today]);
  useEffect(() => {
    if (plan && plan.daysLeft > 0) award("event");
  }, [plan]);

  const toggleGoal = (g: Goal) => setSaved((s) => ({ ...s, goals: s.goals.includes(g) ? s.goals.filter((x) => x !== g) : [...s.goals, g] }));
  const noun = EVENT_NOUN[saved.type];
  const ask = plan ? `I have ${plan.daysLeft} days until ${noun}. My goals: ${saved.goals.map((g) => GOAL_LABEL[g]).join(", ") || "glow"}. What would NEA do first, and what should I avoid?` : "";

  return (
    <div className="space-y-5">
      {/* the questions */}
      <section className="surface rounded-[28px] p-5 md:p-7" aria-label="Your event">
        <div className="grid gap-6 md:grid-cols-3">
          <fieldset>
            <legend className="text-[13px] uppercase tracking-[0.12em] text-graphite">1. What's the day?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(EVENT_LABEL) as EventType[]).map((t) => (
                <button key={t} onClick={() => setSaved((s) => ({ ...s, type: t }))} aria-pressed={saved.type === t} className={cn("rounded-full border px-3.5 py-2 text-[14px] transition", saved.type === t ? "border-ink bg-ink text-white" : "border-ink/10 bg-white/70 text-ink hover:border-ink/25")}>
                  {EVENT_LABEL[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="event-date" className="text-[13px] uppercase tracking-[0.12em] text-graphite">
              2. When is it?
            </label>
            <input id="event-date" type="date" value={saved.date} min={inDays(1)} onChange={(e) => setSaved((s) => ({ ...s, date: e.target.value }))} className="mt-2 block w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-flora" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK.map(([label, n]) => (
                <button key={label} onClick={() => setSaved((s) => ({ ...s, date: inDays(n) }))} className="rounded-full bg-ink/[0.05] px-3 py-1.5 text-[12.5px] text-ink hover:bg-ink/10">
                  {label}
                </button>
              ))}
            </div>
          </div>
          <fieldset>
            <legend className="text-[13px] uppercase tracking-[0.12em] text-graphite">3. What do you want?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => {
                const on = saved.goals.includes(g);
                return (
                  <button key={g} onClick={() => toggleGoal(g)} aria-pressed={on} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] transition", on ? "border-flora/50 bg-flora-soft text-ink" : "border-ink/10 bg-white/70 text-ink hover:border-ink/25")}>
                    {on && <Check className="h-3.5 w-3.5 text-flora" />} {GOAL_LABEL[g]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      {!ready || !today ? (
        <div className="surface h-40 animate-pulse rounded-[28px]" aria-hidden />
      ) : !plan ? (
        <section className="surface rounded-[28px] p-8 text-center">
          <CalendarHeart className="mx-auto h-8 w-8 text-flora" />
          <p className="mt-3 font-display text-[1.7rem] leading-tight text-ink">{saved.date ? "Pick a day in the future." : "Pick your day to see your plan."}</p>
          <p className="mx-auto mt-1 max-w-sm text-[15px] text-graphite">We work backwards from the date, so every step has time to settle.</p>
        </section>
      ) : (
        <>
          {/* the countdown */}
          <section className="relative overflow-hidden rounded-[32px] bg-ink p-6 text-white md:p-9" aria-label="Countdown">
            <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: "var(--aurora)" }} />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[14px] text-white/70">{longDate(parseDay(saved.date))}</p>
                <p className="mt-1 font-display leading-none">
                  <span className="tabular text-[clamp(3.6rem,16vw,6rem)]">{plan.daysLeft}</span>
                  <span className="ml-2 text-[clamp(1.3rem,5vw,2rem)]">day{plan.daysLeft === 1 ? "" : "s"} to {noun}</span>
                </p>
              </div>
              <p className="rounded-2xl bg-white/10 px-4 py-3 text-[14px] leading-snug backdrop-blur">
                <span className="tabular block font-display text-[1.6rem] leading-none">{plan.steps.length}</span>
                steps in your plan
              </p>
            </div>
          </section>

          {/* the timeline */}
          <section className="surface rounded-[28px] p-5 md:p-7" aria-label="Your plan, step by step">
            <h2 className="flex items-center gap-2 font-display text-[1.6rem] text-ink">
              <Sparkles className="h-5 w-5 text-flora" /> Your plan, step by step
            </h2>
            <ol className="relative mt-5 space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-ink/10">
              {plan.steps.map((s, i) => (
                <motion.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-4">
                  <span className={cn("tabular relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-medium", s.state === "now" ? "border-flora bg-flora text-white" : "border-ink/15 bg-porcelain text-ink")}>{i + 1}</span>
                  <div className={cn("min-w-0 flex-1 rounded-2xl border p-4", s.state === "now" ? "border-flora/30 bg-white" : "border-ink/[0.07] bg-white/70")}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <h3 className="font-sans text-[16px] font-medium tracking-normal text-ink">{s.title}</h3>
                      <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", s.state === "now" ? "bg-flora-soft text-flora" : s.state === "soon" ? "bg-amber-100 text-amber-800" : "bg-ink/[0.05] text-graphite")}>{s.state === "now" ? "Do this now" : `${shortDate(s.date)} · ${s.when}`}</span>
                    </div>
                    <p className="mt-1 text-[14px] leading-snug text-graphite">{s.detail}</p>
                    {s.book && (
                      <button onClick={() => book.open(s.book!.key, s.book!.label)} className={cn("mt-3 !px-4 !py-2 !text-[14px]", s.state === "now" ? "btn-light" : "btn-ghost")}>
                        <CalendarHeart className="h-4 w-4" /> Book
                      </button>
                    )}
                    {s.href && (
                      <Link href={s.href} className="btn-ghost mt-3 !px-4 !py-2 !text-[14px]">
                        Check my routine <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </motion.li>
              ))}
              <li className="relative flex gap-4">
                <span className="relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--aurora)" }}>
                  <Sparkles className="h-4 w-4 text-ink" />
                </span>
                <p className="self-center font-display text-[1.3rem] text-ink">
                  {shortDate(parseDay(saved.date))}: {noun}.
                </p>
              </li>
            </ol>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Rules for the last weeks">
              <h2 className="font-display text-[1.4rem] text-ink">Three rules</h2>
              <ul className="mt-3 space-y-2">
                {plan.rules.map((r) => (
                  <li key={r} className="flex gap-2.5 text-[14.5px] leading-snug text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-flora" /> {r}
                  </li>
                ))}
              </ul>
            </section>
            {plan.skipped.length > 0 && (
              <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Skipped for now">
                <h2 className="font-display text-[1.4rem] text-ink">Too close for this time</h2>
                <p className="mt-1 text-[13.5px] text-graphite">We left these out to keep your skin safe. Save them for after.</p>
                <ul className="mt-3 space-y-2">
                  {plan.skipped.map((s) => (
                    <li key={s.id} className="flex gap-2.5 text-[14.5px] leading-snug">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-graphite" />
                      <span>
                        <span className="text-ink">{s.title}.</span> <span className="text-graphite">{s.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => book.open("skin-scan", "Free skin scan")} className="btn-primary justify-center">
              <CalendarHeart className="h-4 w-4" /> Start with a free skin scan
            </button>
            <button
              onClick={() =>
                downloadIcs("nea-event-plan", [
                  ...plan.steps.map((s) => ({ date: s.date, title: `NEA: ${s.title}`, note: `${s.detail} Book at neaprecisionskin.com/book` })),
                  { date: parseDay(saved.date), title: `${EVENT_LABEL[saved.type]} day`, note: "You're ready. Enjoy it." },
                ])
              }
              className="btn-ghost justify-center"
            >
              <CalendarCheck className="h-4 w-4" /> Add the plan to my calendar
            </button>
            <button onClick={() => ai.open({ context: "Event Countdown", query: ask })} className="btn-ghost justify-center">
              <NeaSiIcon className="h-4 w-4" /> Ask Nea SI
            </button>
          </div>
        </>
      )}
      <p className="flex gap-2 text-[12.5px] leading-snug text-graphite">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />A general guide. Your NEA provider sets the real timing after seeing your skin. Results vary. Your plan is saved on this phone only.
      </p>
    </div>
  );
}
