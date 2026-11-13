"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarCheck, CalendarHeart, Check, Clock, Hourglass, ShieldCheck, Sparkles, Syringe, Timer, X } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useAi } from "@/components/ai/ai-provider";
import { useBooking } from "@/components/booking/booking";
import { INJECT_AREAS, KIND_LABEL, type InjectArea, type InjectKind } from "@/content/injectables";
import { KEYS, award, dayKey, useStored } from "@/lib/glow-store";
import { parseDay } from "@/lib/event-plan";
import { downloadIcs, longDate } from "@/lib/ics";
import { cn, money } from "@/lib/utils";

type Saved = { ids: string[]; date: string };
const KIND_DOT: Record<InjectKind, string> = { relaxer: "rgb(var(--viz-1))", filler: "rgb(var(--viz-2))", fat: "rgb(var(--viz-3))" };
const addMonths = (d: Date, m: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + Math.round(m * 30.44));
  return out;
};

/**
 * Injectables Planner. Tap an area on the face to see what is usually used there, how much, how long it lasts,
 * the recovery and when a top-up is due. Builds a plan, adds top-up reminders to the calendar and books a consult.
 * Typical ranges only: the injector sets the real dose.
 */
export function InjectablesPlanner() {
  const [saved, setSaved, ready] = useStored<Saved>(KEYS.plan, { ids: [], date: "" });
  const [focus, setFocus] = useState<string>("forehead");
  const ai = useAi();
  const book = useBooking();
  const chosen = useMemo(() => INJECT_AREAS.filter((a) => saved.ids.includes(a.id)), [saved.ids]);
  const area = INJECT_AREAS.find((a) => a.id === focus)!;
  const date = saved.date || dayKey();
  const start = parseDay(date);

  useEffect(() => {
    if (saved.ids.length) award("planner");
  }, [saved.ids.length]);

  const toggle = (id: string) => setSaved((s) => ({ ...s, ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] }));
  const tap = (id: string) => {
    setFocus(id);
    if (!saved.ids.includes(id)) toggle(id);
  };
  const kinds = new Set(chosen.map((a) => a.kind));
  const bookKey = kinds.size === 1 ? chosen[0].book : "healthy-aging";
  const reminders = chosen.map((a) => ({ date: addMonths(start, a.topUpMonths[0]), title: a.kind === "fat" ? `NEA: next ${a.name.toLowerCase()} session` : `NEA: ${a.name} top-up is due about now`, note: `Usually lasts ${a.lasts}. Book at neaprecisionskin.com/book` }));
  const ask = `I'm planning injectables at NEA: ${chosen.map((a) => `${a.name} (${KIND_LABEL[a.kind].toLowerCase()})`).join(", ")}. What should I know before my consult, and in what order would you do them?`;
  const slowest = chosen.length ? Math.max(...chosen.map((a) => a.latestBeforeEventWeeks)) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      {/* the face */}
      <section className="surface min-w-0 rounded-[28px] p-5 md:p-6 lg:sticky lg:top-24" aria-label="Choose areas on the face">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[1.6rem] text-ink">Tap an area</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-graphite">
            {(Object.keys(KIND_LABEL) as InjectKind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_DOT[k] }} /> {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto mt-3 w-full max-w-[340px]" style={{ aspectRatio: "300 / 400" }}>
          <FaceArt />
          {INJECT_AREAS.flatMap((a) =>
            a.at.map(([x, y], i) => {
              const on = saved.ids.includes(a.id);
              const hot = focus === a.id;
              return (
                <button
                  key={`${a.id}-${i}`}
                  onClick={() => tap(a.id)}
                  aria-label={`${a.name}${on ? ", in your plan" : ""}`}
                  aria-pressed={on}
                  tabIndex={i === 0 ? 0 : -1}
                  className="group absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  style={{ left: `${(x / 300) * 100}%`, top: `${(y / 400) * 100}%` }}
                >
                  {hot && <span className="absolute h-8 w-8 animate-ping rounded-full opacity-30" style={{ background: KIND_DOT[a.kind] }} />}
                  <span className={cn("relative grid place-items-center rounded-full border-2 border-white shadow-md transition-all", on ? "h-6 w-6" : "h-4 w-4 group-hover:h-5 group-hover:w-5")} style={{ background: on ? KIND_DOT[a.kind] : "rgba(255,255,255,0.9)", borderColor: on ? "#fff" : KIND_DOT[a.kind] }}>
                    {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                </button>
              );
            }),
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {INJECT_AREAS.map((a) => {
            const on = saved.ids.includes(a.id);
            return (
              <button key={a.id} onClick={() => tap(a.id)} className={cn("rounded-full border px-3 py-1.5 text-[13px] transition", focus === a.id ? "border-ink bg-ink text-white" : on ? "border-flora/40 bg-flora-soft text-ink" : "border-ink/10 bg-white/70 text-ink hover:border-ink/25")}>
                {a.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="min-w-0 space-y-5">
        {/* the area in focus */}
        <AnimatePresence mode="wait">
          <motion.section key={area.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="surface rounded-[28px] p-5 md:p-6" aria-label={area.name}>
            <p className="flex items-center gap-2 text-[13px]" style={{ color: KIND_DOT[area.kind] }}>
              <Syringe className="h-4 w-4" /> {KIND_LABEL[area.kind]}
            </p>
            <h2 className="mt-1 font-display text-[clamp(1.6rem,5vw,2.1rem)] leading-tight text-ink">{area.name}</h2>
            <p className="mt-1 text-[15.5px] leading-relaxed text-graphite">{area.goal}</p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <Fact icon={<Syringe className="h-4 w-4" />} label="Usual amount" value={area.amount} />
              <Fact icon={<Hourglass className="h-4 w-4" />} label="Lasts" value={area.lasts} />
              <Fact icon={<Timer className="h-4 w-4" />} label="You see it" value={area.seen} />
              <Fact icon={<Clock className="h-4 w-4" />} label="Recovery" value={area.recovery} />
            </dl>
            <p className="mt-3 text-[14px] text-ink">
              <span className="text-graphite">Price: </span>
              {area.price ? (
                <>
                  {area.price.label} <span className="tabular font-medium">{money(area.price.amount)}</span>. Your exact price is confirmed at your consult.
                </>
              ) : (
                "set by the amount you need. Confirmed at your consult, before anything is done."
              )}
            </p>
            <button onClick={() => toggle(area.id)} className={cn("mt-4 w-full justify-center", saved.ids.includes(area.id) ? "btn-ghost" : "btn-light")}>
              {saved.ids.includes(area.id) ? (
                <>
                  <X className="h-4 w-4" /> Remove from my plan
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Add to my plan
                </>
              )}
            </button>
          </motion.section>
        </AnimatePresence>

        {/* the plan */}
        <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Your plan">
          <h2 className="flex items-center gap-2 font-display text-[1.6rem] text-ink">
            <Sparkles className="h-5 w-5 text-flora" /> Your plan
          </h2>
          {!ready ? null : chosen.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-ink/15 p-5 text-center text-[14.5px] text-graphite">Tap the areas you're curious about. Your plan builds here.</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                <label htmlFor="inj-date" className="text-graphite">
                  If I start on
                </label>
                <input id="inj-date" type="date" value={date} min={dayKey()} onChange={(e) => setSaved((s) => ({ ...s, date: e.target.value }))} className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-[14.5px] text-ink outline-none focus:border-flora" />
              </div>
              <ul className="mt-3 space-y-2">
                {chosen.map((a) => {
                  const [lo, hi] = a.topUpMonths;
                  return (
                    <li key={a.id} className="rounded-2xl border border-ink/[0.07] bg-white/75 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <button onClick={() => setFocus(a.id)} className="min-w-0 text-left">
                          <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_DOT[a.kind] }} /> {a.name}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-graphite">
                            {a.amount} · lasts {a.lasts.toLowerCase()}
                          </span>
                        </button>
                        <button onClick={() => toggle(a.id)} aria-label={`Remove ${a.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-graphite hover:bg-ink/[0.05] hover:text-ink">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 flex items-center gap-2 rounded-xl bg-mist/70 px-3 py-2 text-[13.5px] text-ink">
                        <CalendarCheck className="h-4 w-4 shrink-0 text-flora" />
                        {a.kind === "fat" ? (
                          <span>
                            Next session around <strong className="font-semibold">{longDate(addMonths(start, lo))}</strong>
                          </span>
                        ) : (
                          <span>
                            Top-up between <strong className="font-semibold">{longDate(addMonths(start, lo))}</strong> and <strong className="font-semibold">{longDate(addMonths(start, hi))}</strong>
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {slowest > 0 && (
                <p className="mt-3 rounded-2xl bg-flora-soft p-3.5 text-[13.5px] leading-snug text-ink">
                  Have a big day coming? Do this plan at least <strong className="font-semibold">{slowest} weeks</strong> before it.{" "}
                  <Link href="/countdown" className="inline-flex items-center gap-1 font-medium text-flora underline-offset-4 hover:underline">
                    Make an event countdown <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </p>
              )}
              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                <button onClick={() => book.open(bookKey, "Injectables consult")} className="btn-primary justify-center">
                  <CalendarHeart className="h-4 w-4" /> Book my consult
                </button>
                <button onClick={() => downloadIcs("nea-top-up-reminders", reminders)} className="btn-ghost justify-center">
                  <CalendarCheck className="h-4 w-4" /> Add reminders to my calendar
                </button>
                <button onClick={() => ai.open({ context: "Injectables Planner", query: ask })} className="btn-ghost justify-center">
                  <NeaSiIcon className="h-4 w-4" /> Ask Nea SI
                </button>
              </div>
            </>
          )}
        </section>
        <p className="flex gap-2 text-[12.5px] leading-snug text-graphite">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These are typical ranges for planning, not medical advice. Everyone is different. A licensed NEA injector looks at your face, checks your health history and sets your treatment and dose at a consult. Results vary. Your plan is saved on this phone only.
        </p>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/[0.06] bg-white/70 p-3">
      <dt className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.1em] text-graphite">
        <span className="text-flora">{icon}</span> {label}
      </dt>
      <dd className="mt-1 text-[14.5px] leading-snug text-ink">{value}</dd>
    </div>
  );
}

/** A calm, simple line drawing of a face (no photo), so the map works for everyone. */
function FaceArt() {
  return (
    <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="inj-skin" cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="rgb(var(--c-warm))" stopOpacity="0.38" />
          <stop offset="1" stopColor="rgb(var(--c-warm))" stopOpacity="0.14" />
        </radialGradient>
      </defs>
      {/* hair, behind the face */}
      <path d="M150 10 C 236 8 280 78 270 176 C 266 226 276 276 290 318 C 262 322 240 310 232 288 C 246 240 250 205 248 165 C 250 92 215 40 150 40 C 85 40 50 92 52 165 C 50 205 54 240 68 288 C 60 310 38 322 10 318 C 24 276 34 226 30 176 C 20 78 64 8 150 10 Z" fill="rgb(var(--c-ink))" fillOpacity="0.09" />
      {/* neck and shoulders */}
      <path d="M118 318 C 118 350 114 370 78 388 C 66 394 60 398 58 400 L 242 400 C 240 398 234 394 222 388 C 186 370 182 350 182 318 Z" fill="rgb(var(--c-bg))" />
      <path d="M118 318 C 118 350 114 370 78 388 C 66 394 60 398 58 400 L 242 400 C 240 398 234 394 222 388 C 186 370 182 350 182 318 Z" fill="url(#inj-skin)" />
      <path d="M118 326 C 118 352 114 370 78 388 M182 326 C 182 352 186 370 222 388" fill="none" stroke="rgb(var(--c-ink))" strokeOpacity="0.22" strokeWidth="1.2" strokeLinecap="round" />
      {/* face */}
      <path d="M150 34 C 215 34 250 92 248 165 C 246 248 208 346 150 350 C 92 346 54 248 52 165 C 50 92 85 34 150 34 Z" fill="rgb(var(--c-bg))" />
      <path d="M150 34 C 215 34 250 92 248 165 C 246 248 208 346 150 350 C 92 346 54 248 52 165 C 50 92 85 34 150 34 Z" fill="url(#inj-skin)" stroke="rgb(var(--c-ink))" strokeOpacity="0.28" strokeWidth="1.4" />
      {/* hair parting, in front */}
      <path d="M150 34 C 118 40 84 66 66 112 C 62 86 84 44 150 34 Z M150 34 C 182 40 216 66 234 112 C 238 86 216 44 150 34 Z" fill="rgb(var(--c-ink))" fillOpacity="0.09" />
      <g fill="none" stroke="rgb(var(--c-ink))" strokeLinecap="round" strokeLinejoin="round">
        {/* brows */}
        <path d="M86 136 Q 108 122 134 132" strokeOpacity="0.55" strokeWidth="3.2" />
        <path d="M166 132 Q 192 122 214 136" strokeOpacity="0.55" strokeWidth="3.2" />
        {/* closed, resting eyes */}
        <path d="M90 156 Q 111 168 132 156" strokeOpacity="0.6" strokeWidth="1.8" />
        <path d="M168 156 Q 189 168 210 156" strokeOpacity="0.6" strokeWidth="1.8" />
        <path d="M94 160 l -4 5 M104 164 l -2 6 M118 164 l 2 6 M128 160 l 4 5 M172 160 l -4 5 M182 164 l -2 6 M196 164 l 2 6 M206 160 l 4 5" strokeOpacity="0.4" strokeWidth="1.2" />
        {/* nose */}
        <path d="M150 150 C 147 176 142 196 138 208 Q 150 220 162 208" strokeOpacity="0.35" strokeWidth="1.6" />
        {/* lips */}
        <path d="M122 258 Q 138 248 150 254 Q 162 248 178 258 Q 150 266 122 258 Z" fill="rgb(var(--c-accent))" fillOpacity="0.28" strokeOpacity="0.45" strokeWidth="1.3" />
        <path d="M122 258 Q 150 286 178 258" fill="rgb(var(--c-accent))" fillOpacity="0.2" strokeOpacity="0.45" strokeWidth="1.3" />
      </g>
      {/* a little blush */}
      <ellipse cx="92" cy="212" rx="24" ry="15" fill="rgb(var(--c-accent))" fillOpacity="0.09" />
      <ellipse cx="208" cy="212" rx="24" ry="15" fill="rgb(var(--c-accent))" fillOpacity="0.09" />
    </svg>
  );
}
