"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, Camera, CheckCircle2, Clock, Gift, LineChart, ListChecks, MessageCircle, ScanFace, Sparkles, Sun, Timer } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useAi } from "@/components/ai/ai-provider";
import { bookUrl } from "@/content/jane";
import { getOffer } from "@/content/offers";
import { openLiveScan } from "@/components/scan/open-live-scan";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The eight kinds of light, as colour chips (what each one shows is on /skin-scan). */
const LIGHTS = [
  { c: "#f6e7d8", n: "Daylight" },
  { c: "#e9a0a8", n: "Under the skin" },
  { c: "#c9c3bd", n: "Texture" },
  { c: "#4b5bc4", n: "Sun damage" },
  { c: "#8b5cc8", n: "Spot depth" },
  { c: "#d0283c", n: "Redness" },
  { c: "#a46a3c", n: "Dark spots" },
  { c: "#7d7f86", n: "3D lines" },
];

/** Nea SI's guided walk-through: short lines, one tap to the next. */
const GUIDE: { say: string; reply: string }[] = [
  { say: "Hi, I’m Nea SI. Thanks for scanning! Want to see what your free skin scan gives you? It takes one minute.", reply: "Yes, show me" },
  { say: "We have a special skin camera. It takes photos of your face in 8 kinds of light. Your eyes see 1. It sees 8.", reply: "What does it find?" },
  { say: "Things a mirror can’t show you. Sun damage under the skin. Dark spots before they come up. Pores, lines, redness and dry patches. 14+ things in all.", reply: "What do I get?" },
  { say: "Your own skin report. Your skin score. Your skin age. Photos of your skin in every light. Your top 2 or 3 things to fix, and a simple plan.", reply: "Is it really free?" },
  { say: "Yes, 100% free. The photo takes 15 seconds and nothing touches your skin. With us it’s about 20 minutes. No pressure to buy anything.", reply: "How do I book?" },
  { say: "Tap “Book my free scan” and pick a time. That’s it. Want to ask me anything first? I’m right here.", reply: "" },
];

const REPORT = [
  { icon: LineChart, t: "Your skin score", d: "One simple number for how your skin is doing." },
  { icon: Clock, t: "Your skin age", d: "Is your skin older or younger than you?" },
  { icon: Camera, t: "8 photos of your skin", d: "Each light shows something new." },
  { icon: Sun, t: "Hidden sun damage", d: "See it before it shows on the outside." },
  { icon: ListChecks, t: "Your top 3 things to fix", d: "No long list. Just what matters most." },
  { icon: Sparkles, t: "A simple plan", d: "What to do at home, and what we can help with." },
];

/**
 * The page people land on after scanning the free-scan poster's QR code.
 * Nea SI walks them through the offer in short, plain lines, and "Book my free scan" goes straight to booking.
 */
export function QrGuide() {
  const offer = getOffer("skin-scan");
  const book = bookUrl("skin-scan");
  return (
    <div className="pb-32">
      <Hero value={offer?.value} book={book} />
      <Guide book={book} />
      <Report />
      <Steps />
      <FinalCta book={book} />
      <StickyBook book={book} />
    </div>
  );
}

function Hero({ value, book }: { value?: string; book: string }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-24 md:pt-32">
      <div aria-hidden className="absolute -right-32 -top-32 -z-10 h-[420px] w-[420px] rounded-full opacity-70 blur-3xl" style={{ background: "var(--aurora)" }} />
      <div className="container max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3.5 py-1.5 text-[13px] text-ink backdrop-blur">
          <Gift className="h-4 w-4 text-flora" /> Free skin scan
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.6rem,9vw,5.2rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          See your skin <span className="aurora-text italic">in 8 kinds of light.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[18px] leading-relaxed text-graphite">A free skin scan. 15 seconds. You leave knowing what your skin needs.</p>
        {/* the 8 lights */}
        <div className="mx-auto mt-8 flex max-w-sm justify-center gap-1.5" aria-label="8 kinds of light">
          {LIGHTS.map((l, i) => (
            <motion.span key={l.n} title={l.n} className="h-10 flex-1 rounded-full ring-1 ring-ink/10" style={{ background: l.c }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: EASE }} />
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <a href={book} target="_blank" rel="noopener" className="btn-light w-full max-w-xs !py-4 !text-[17px]">
            <CalendarHeart className="h-5 w-5" /> Book my free scan
          </a>
          <button onClick={openLiveScan} className="btn-ghost w-full max-w-xs !py-3.5">
            <Camera className="h-5 w-5" /> Try a live face scan now
          </button>
          {value && <p className="text-[13px] text-graphite">Normally {value.replace(/^A /, "a ")}. Free for you.</p>}
        </div>
      </div>
    </section>
  );
}

function Guide({ book }: { book: string }) {
  const ai = useAi();
  const [n, setN] = useState(1);
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const next = () => {
    if (n >= GUIDE.length) return;
    setTyping(true);
    window.setTimeout(() => (setTyping(false), setN((v) => v + 1)), 650);
  };
  useEffect(() => {
    if (n > 1) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [n, typing]);
  const done = n >= GUIDE.length;

  return (
    <section className="py-10">
      <div className="container max-w-xl">
        <div className="rounded-[32px] border border-ink/[0.07] bg-white p-4 shadow-[0_40px_100px_-60px_rgba(var(--shadow-tint),0.8)] sm:p-6">
          <div className="flex items-center gap-3 border-b border-ink/[0.06] pb-4">
            <span className="grid h-11 w-11 place-items-center rounded-full [background:var(--aurora)]">
              <NeaSiIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-ink">Nea SI</p>
              <p className="flex items-center gap-1.5 text-[12.5px] text-graphite">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2fb36b]" /> Your guide to the free scan
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3" aria-live="polite">
            {GUIDE.slice(0, n).map((g, i) => (
              <div key={i} className="space-y-3">
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-[88%] rounded-3xl rounded-tl-md bg-porcelain px-4 py-3 text-[16px] leading-relaxed text-ink">
                  {g.say}
                </motion.p>
                {i < n - 1 && g.reply && <p className="ml-auto w-fit max-w-[80%] rounded-3xl rounded-tr-md bg-ink px-4 py-2.5 text-[15px] text-white">{g.reply}</p>}
              </div>
            ))}
            <AnimatePresence>
              {typing && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-fit gap-1 rounded-3xl rounded-tl-md bg-porcelain px-4 py-4" aria-label="Nea SI is typing">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ink/40" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </motion.p>
              )}
            </AnimatePresence>
            <div ref={end} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!done && !typing && (
              <button onClick={next} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 text-[15px] font-medium text-ink transition hover:border-ink/40 active:scale-[0.97]">
                {GUIDE[n - 1].reply}
              </button>
            )}
            {done && (
              <>
                <a href={book} target="_blank" rel="noopener" className="btn-light !px-5 !py-3">
                  <CalendarHeart className="h-4 w-4" /> Book my free scan
                </a>
                <button onClick={() => ai.open({ query: "Tell me more about the free skin scan", context: "Visitor scanned the free skin scan poster QR code" })} className="btn-ghost !px-5 !py-3">
                  <MessageCircle className="h-4 w-4" /> Ask Nea SI
                </button>
              </>
            )}
          </div>
          {!done && (
            <button onClick={() => ai.open({ query: "Tell me about the free skin scan", context: "Visitor scanned the free skin scan poster QR code" })} className="mt-3 text-[13.5px] text-graphite underline-offset-4 hover:text-ink hover:underline">
              Or ask your own question
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Report() {
  return (
    <section className="py-12">
      <div className="container max-w-4xl">
        <h2 className="text-center font-display text-[clamp(2rem,6vw,3.4rem)] leading-[1] text-ink">Your free report shows you</h2>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT.map((r, i) => (
            <motion.li key={r.t} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: EASE }} className="flex gap-4 rounded-[24px] border border-ink/[0.07] bg-white p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full [background:var(--aurora)]">
                <r.icon className="h-5 w-5 text-ink" />
              </span>
              <span>
                <span className="block font-display text-[1.35rem] leading-tight text-ink">{r.t}</span>
                <span className="mt-1 block text-[15px] text-graphite">{r.d}</span>
              </span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-5 flex items-start justify-center gap-2 text-center text-[14.5px] text-graphite">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-flora" /> Start a plan, and we scan you again free in 90 days so you can see the change.
        </p>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: CalendarHeart, t: "Book", d: "Pick a time that works for you." },
    { icon: ScanFace, t: "Sit for 15 seconds", d: "Look into the camera. Nothing touches your skin." },
    { icon: Timer, t: "See your report", d: "We go through it with you, in plain words." },
  ];
  return (
    <section className="py-12">
      <div className="container max-w-4xl">
        <h2 className="text-center font-display text-[clamp(2rem,6vw,3.4rem)] leading-[1] text-ink">Easy as 1, 2, 3.</h2>
        <ol className="mt-10 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-[24px] bg-mist/70 p-5 text-center">
              <span className="tabular font-display text-[2.4rem] leading-none text-ink/25">{i + 1}</span>
              <s.icon className="mx-auto mt-2 h-6 w-6 text-flora" />
              <p className="mt-3 font-display text-[1.4rem] text-ink">{s.t}</p>
              <p className="mt-1 text-[15px] text-graphite">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta({ book }: { book: string }) {
  return (
    <section className="py-14 text-center">
      <div className="container max-w-xl">
        <h2 className="font-display text-[clamp(2.2rem,7vw,3.8rem)] leading-[1] text-ink">Your skin has a story.</h2>
        <p className="mt-3 font-display text-[clamp(1.4rem,4vw,2rem)] italic text-graphite">Come see it. It’s free.</p>
        <a href={book} target="_blank" rel="noopener" className="btn-light mt-8 w-full max-w-xs !py-4 !text-[17px]">
          <CalendarHeart className="h-5 w-5" /> Book my free scan
        </a>
      </div>
    </section>
  );
}

/** Always one tap away on phones. */
function StickyBook({ book }: { book: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 420);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed left-4 right-[5.25rem] z-[60] md:hidden" style={{ bottom: "calc(var(--dock-h) + 0.5rem)" }}>
          <a href={book} target="_blank" rel="noopener" className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-semibold text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
            <CalendarHeart className="h-5 w-5" /> Book my free scan
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
