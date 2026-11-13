"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Barcode, CalendarHeart, Camera, Check, Loader2, Moon, Plus, Search, ShieldCheck, Sun, Trash2, TriangleAlert, X } from "lucide-react";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { useAi } from "@/components/ai/ai-provider";
import { useBooking } from "@/components/booking/booking";
import { KEYS, award, uid, useStored } from "@/lib/glow-store";
import { ACTIVE_LABEL, QUICK, TYPE_LABEL, analyse, buildRoutine, type Product, type ProductType, type Step } from "@/lib/routine";
import { cn } from "@/lib/utils";

type Found = { code: string; name: string; brand?: string; ingredients: string; categories: string; image?: string };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const detectorCtor = () => (typeof window !== "undefined" ? (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector : undefined);

const fromFound = (f: Found): Product => ({ id: uid(), name: f.name, brand: f.brand, image: f.image, barcode: f.code || undefined, ...analyse(`${f.brand ?? ""} ${f.name}`, f.ingredients, f.categories) });

/**
 * Routine Builder. Add the products you own (scan the barcode, search by name, or pick a type) and see
 * the right order for morning and night, what clashes, what to be careful with and what is missing.
 * The list is saved on this phone only.
 */
export function RoutineBuilder() {
  const [products, setProducts, ready] = useStored<Product[]>(KEYS.routine, []);
  const [tab, setTab] = useState<"scan" | "search" | "type">("type");
  const [canScan, setCanScan] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const ai = useAi();
  const book = useBooking();
  const routine = useMemo(() => buildRoutine(products), [products]);

  useEffect(() => {
    const ok = Boolean(detectorCtor()) && Boolean(navigator.mediaDevices?.getUserMedia);
    setCanScan(ok);
    setTab(ok ? "scan" : "search");
  }, []);
  useEffect(() => {
    if (products.length >= 2) award("routine");
  }, [products.length]);

  const add = (p: Product) => {
    if (products.length >= 30) return setNote({ ok: false, text: "That's a lot of products. Remove one before adding more." });
    if (p.barcode && products.some((x) => x.barcode === p.barcode)) return setNote({ ok: false, text: `${p.name} is already in your list.` });
    setProducts((list) => [...list, p]);
    setNote({ ok: true, text: `Added ${p.name}.` });
  };
  const lookup = async (code: string): Promise<boolean> => {
    setNote(null);
    try {
      const res = await fetch(`/api/product?code=${encodeURIComponent(code)}`);
      const d = (await res.json().catch(() => ({}))) as { products?: Found[]; error?: string };
      if (!res.ok) throw new Error(d.error);
      if (d.products?.[0]) {
        add(fromFound(d.products[0]));
        return true;
      }
      setNote({ ok: false, text: "We don't know that barcode yet. Search its name, or pick its type." });
      setTab("search");
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message || "We couldn't look that up. Pick the product type instead." });
      setTab("type");
    }
    return false;
  };
  const setType = (id: string, type: ProductType) => setProducts((list) => list.map((p) => (p.id === id ? { ...p, type, known: true } : p)));
  const remove = (id: string) => setProducts((list) => list.filter((p) => p.id !== id));

  const ask = `My skincare routine: ${products.map((p) => `${p.brand ? p.brand + " " : ""}${p.name} (${TYPE_LABEL[p.type]}${p.actives.length ? ", " + p.actives.map((a) => ACTIVE_LABEL[a]).join(" + ") : ""})`).join("; ")}. Is this a good routine, and what would NEA change?`;

  if (!ready) return <div className="surface h-64 animate-pulse rounded-[32px]" aria-hidden />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      {/* add + list */}
      <div className="min-w-0 space-y-5">
        <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Add a product">
          <h2 className="font-display text-[1.6rem] text-ink">Add what you use</h2>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-ink/[0.05] p-1" role="tablist">
            {(
              [
                ["scan", "Scan", Barcode],
                ["search", "Search", Search],
                ["type", "Pick type", Plus],
              ] as const
            ).map(([k, label, I]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => (setTab(k), setNote(null))} className={cn("flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] transition", tab === k ? "bg-white font-medium text-ink shadow-sm" : "text-graphite")}>
                <I className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "scan" && <Scanner canScan={canScan} onCode={lookup} />}
            {tab === "search" && <NameSearch onPick={(f) => add(fromFound(f))} onNone={() => setTab("type")} />}
            {tab === "type" && (
              <div>
                <p className="text-[14px] text-graphite">Tap each kind of product you own.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button key={q.name} onClick={() => add({ id: uid(), name: q.name, type: q.type, actives: q.actives, flags: [], known: true })} className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/80 px-3.5 py-2.5 text-[14px] text-ink transition hover:border-flora/40 hover:bg-white active:scale-[0.97]">
                      <Plus className="h-3.5 w-3.5 text-flora" /> {q.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {note && (
            <p className={cn("mt-3 flex items-center gap-1.5 text-[13.5px]", note.ok ? "text-sky" : "text-flora")} role="status">
              {note.ok ? <Check className="h-4 w-4 shrink-0" /> : <TriangleAlert className="h-4 w-4 shrink-0" />} {note.text}
            </p>
          )}
        </section>

        <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Your products">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[1.6rem] text-ink">Your shelf</h2>
            <span className="tabular text-[13px] text-graphite">
              {products.length} product{products.length === 1 ? "" : "s"}
            </span>
          </div>
          {products.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-ink/15 p-5 text-center text-[14.5px] text-graphite">Nothing yet. Add your cleanser, moisturiser and anything else you use.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {products.map((p) => (
                  <motion.li key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="rounded-2xl border border-ink/[0.07] bg-white/75 p-3">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain" loading="lazy" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-flora-soft font-display text-[1.2rem] text-flora">{p.name[0]}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink">{p.name}</span>
                        {p.brand && <span className="block truncate text-[12.5px] text-graphite">{p.brand}</span>}
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium", routine.verdict[p.id] === "care" ? "bg-amber-100 text-amber-800" : "bg-sky-soft text-sky")}>{routine.verdict[p.id] === "care" ? "Use with care" : "Keep"}</span>
                      <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-graphite hover:bg-ink/[0.05] hover:text-ink">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <label className="sr-only" htmlFor={`type-${p.id}`}>
                        What kind of product is {p.name}?
                      </label>
                      <select id={`type-${p.id}`} value={p.type} onChange={(e) => setType(p.id, e.target.value as ProductType)} className={cn("rounded-full border bg-white px-3 py-1.5 text-[13px] text-ink outline-none focus:border-flora", p.type === "other" ? "border-flora" : "border-ink/15")}>
                        {(Object.keys(TYPE_LABEL) as ProductType[]).map((t) => (
                          <option key={t} value={t}>
                            {t === "other" ? "What is it? Choose…" : TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      {p.actives.map((a) => (
                        <span key={a} className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[12px] text-ink">
                          {ACTIVE_LABEL[a]}
                        </span>
                      ))}
                      {p.flags.includes("fragrance") && <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[12px] text-graphite">Fragrance</span>}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <p className="mt-3 flex gap-2 text-[12.5px] leading-snug text-graphite">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Saved on this phone only.
          </p>
        </section>
      </div>

      {/* the routine */}
      <div className="min-w-0 space-y-5 lg:sticky lg:top-24">
        {products.length === 0 ? (
          <section className="surface rounded-[28px] p-6 text-center md:p-10">
            <p className="font-display text-[1.7rem] leading-tight text-ink">Your routine shows up here.</p>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-graphite">Add your products and we put them in the right order for morning and night, and tell you what clashes and what's missing.</p>
          </section>
        ) : (
          <>
            <section className="surface rounded-[28px] p-5 md:p-6" aria-label="Routine check">
              <div className="flex items-center gap-4">
                <Ring value={routine.score} />
                <div>
                  <h2 className="font-display text-[1.6rem] leading-tight text-ink">{routine.score >= 85 ? "A solid routine." : routine.score >= 60 ? "Good, with a few fixes." : "This routine needs some help."}</h2>
                  <p className="text-[14px] text-graphite">
                    {routine.advice.filter((a) => a.tone !== "info").length} to fix · {routine.missing.length} missing
                  </p>
                </div>
              </div>
              {(routine.advice.length > 0 || routine.missing.length > 0) && (
                <ul className="mt-4 space-y-2">
                  {routine.advice.map((a) => (
                    <li key={a.title} className={cn("rounded-2xl border p-3.5", a.tone === "stop" ? "border-flora/30 bg-flora-soft" : a.tone === "care" ? "border-amber-200 bg-amber-50" : "border-ink/[0.07] bg-white/70")}>
                      <p className="flex items-start gap-2 text-[14.5px] font-medium text-ink">
                        {a.tone === "info" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky" /> : <TriangleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", a.tone === "stop" ? "text-flora" : "text-amber-700")} />} {a.title}
                      </p>
                      <p className="mt-1 pl-6 text-[13.5px] leading-snug text-graphite">{a.text}</p>
                    </li>
                  ))}
                  {routine.missing.map((m) => (
                    <li key={m.key} className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-3.5">
                      <p className="flex items-start gap-2 text-[14.5px] font-medium text-ink">
                        <Plus className="mt-0.5 h-4 w-4 shrink-0 text-flora" /> Missing: {m.title}
                      </p>
                      <p className="mt-1 pl-6 text-[13.5px] leading-snug text-graphite">{m.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <Order title="Morning" icon={<Sun className="h-5 w-5 text-flora" />} steps={routine.am} empty="No morning products yet." />
              <Order title="Night" icon={<Moon className="h-5 w-5 text-flora" />} steps={routine.pm} empty="No night products yet." />
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button onClick={() => ai.open({ context: "Routine Builder", query: ask })} className="btn-light justify-center">
                <NeaSiIcon className="h-4 w-4" /> Ask Nea SI about my routine
              </button>
              <button onClick={() => book.open("medical-grade-skincare", "Skincare consult")} className="btn-ghost justify-center">
                <CalendarHeart className="h-4 w-4" /> Book a skincare consult
              </button>
            </div>
            <Link href="/experiences/bring-your-bag" className="surface flex items-center gap-3 rounded-[22px] p-4 transition hover:bg-white">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">Bring Your Bag</span>
                <span className="block text-[13px] leading-snug text-graphite">Bring your real products to NEA. We check every label against your skin scan.</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-graphite" />
            </Link>
            <p className="text-[12.5px] leading-snug text-graphite">A guide based on common skincare rules, not medical advice. If you use a prescription cream, follow your doctor. Product details come from Open Beauty Facts, an open community list, and may be incomplete.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-[76px] w-[76px] shrink-0 place-items-center" role="img" aria-label={`Routine score ${value} out of 100`}>
      <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgb(var(--c-ink))" strokeOpacity="0.08" strokeWidth="7" />
        <motion.circle cx="38" cy="38" r={r} fill="none" stroke="rgb(var(--viz-1))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 0.7 }} />
      </svg>
      <span className="tabular font-display text-[1.5rem] leading-none text-ink">{value}</span>
    </span>
  );
}

function Order({ title, icon, steps, empty }: { title: string; icon: React.ReactNode; steps: Step[]; empty: string }) {
  return (
    <section className="surface rounded-[28px] p-5" aria-label={`${title} routine`}>
      <h3 className="flex items-center gap-2 font-display text-[1.4rem] text-ink">
        {icon} {title}
      </h3>
      {steps.length === 0 ? (
        <p className="mt-3 text-[14px] text-graphite">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.product.id} className="flex gap-3">
              <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flora-soft text-[12px] text-flora">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium leading-snug text-ink">{s.product.name}</span>
                <span className="block text-[12.5px] text-graphite">{TYPE_LABEL[s.product.type]}</span>
                {s.note && <span className="mt-0.5 block text-[13px] leading-snug text-flora">{s.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Reads a barcode with the back camera (where the browser can), or takes the numbers typed in. */
function Scanner({ canScan, onCode }: { canScan: boolean; onCode: (code: string) => Promise<boolean> }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  const start = async () => {
    setErr("");
    const Ctor = detectorCtor();
    if (!Ctor) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      setOn(true);
      // wait for the video element to be on the page
      for (let i = 0; i < 40 && !video.current; i++) await new Promise((r) => setTimeout(r, 25));
      const v = video.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("no video");
      }
      v.srcObject = stream;
      await v.play();
      const det = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      let live = true;
      let working = false;
      const timer = window.setInterval(async () => {
        if (!live || working || v.readyState < 2) return;
        working = true;
        try {
          const hit = (await det.detect(v))[0]?.rawValue;
          if (hit && live) {
            end();
            setBusy(true);
            await onCode(hit);
            setBusy(false);
          }
        } catch {
          /* a frame that can't be read is fine */
        }
        working = false;
      }, 250);
      const end = () => {
        live = false;
        window.clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        setOn(false);
      };
      stop.current = end;
    } catch (e) {
      setOn(false);
      setErr((e as Error)?.name === "NotAllowedError" ? "Camera access was blocked. Type the numbers under the barcode instead." : "The camera couldn't start. Type the numbers under the barcode instead.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = typed.replace(/\D/g, "");
    if (code.length < 8) return setErr("A barcode has 8 to 13 numbers.");
    setErr("");
    setBusy(true);
    if (await onCode(code)) setTyped("");
    setBusy(false);
  };

  return (
    <div>
      {canScan &&
        (on ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[34%] -translate-y-1/2 rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(10,8,14,0.4)]" />
            <motion.div aria-hidden className="pointer-events-none absolute inset-x-[12%] h-0.5 bg-flora shadow-[0_0_12px_2px_rgb(var(--c-accent)/0.7)]" animate={{ top: ["36%", "64%", "36%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
            <p className="absolute inset-x-0 bottom-2 text-center text-[13px] text-white drop-shadow">Hold the barcode inside the box</p>
            <button onClick={() => stop.current()} aria-label="Stop the camera" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={start} disabled={busy} className="btn-light w-full !py-3.5 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} {busy ? "Looking it up…" : "Scan a barcode"}
          </button>
        ))}
      {!canScan && <p className="rounded-2xl bg-mist/70 p-3.5 text-[13.5px] leading-snug text-graphite">This browser can't read barcodes with the camera. Type the numbers printed under the barcode, or use Search.</p>}
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="barcode" className="sr-only">
          Barcode numbers
        </label>
        <input id="barcode" inputMode="numeric" pattern="[0-9 ]*" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type the barcode numbers" className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-flora" />
        <button disabled={busy || !typed.trim()} className="btn-ghost shrink-0 !px-5 !py-2.5 !text-[14.5px] disabled:opacity-40">
          {busy && !on ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
        </button>
      </form>
      {err && <p className="mt-2 text-[13.5px] text-flora">{err}</p>}
    </div>
  );
}

function NameSearch({ onPick, onNone }: { onPick: (f: Found) => void; onNone: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Found[] | null>(null);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2 || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/product?q=${encodeURIComponent(q.trim())}`);
      const d = (await res.json().catch(() => ({}))) as { products?: Found[]; error?: string };
      if (!res.ok) throw new Error(d.error);
      setHits(d.products ?? []);
    } catch (e2) {
      setHits(null);
      setErr((e2 as Error).message || "Search isn't answering. Pick the product type instead.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="product-q" className="sr-only">
          Product name
        </label>
        <input id="product-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Brand and product name" enterKeyHint="search" className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-[15px] text-ink outline-none focus:border-flora" />
        <button disabled={busy || q.trim().length < 2} className="btn-light shrink-0 !px-5 !py-2.5 !text-[14.5px] disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>
      {err && <p className="mt-2 text-[13.5px] text-flora">{err}</p>}
      {hits && hits.length === 0 && (
        <p className="mt-3 text-[14px] text-graphite">
          No match.{" "}
          <button onClick={onNone} className="font-medium text-flora underline-offset-4 hover:underline">
            Pick its type instead
          </button>
          .
        </p>
      )}
      {hits && hits.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto" data-lenis-prevent>
          {hits.map((h, i) => (
            <li key={h.code + i}>
              <button onClick={() => onPick(h)} className="flex w-full items-center gap-3 rounded-2xl border border-ink/[0.07] bg-white/80 p-2.5 text-left transition hover:border-flora/40">
                {h.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.image} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-flora-soft text-flora">{h.name[0]}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{h.name}</span>
                  <span className="block truncate text-[12.5px] text-graphite">{h.brand ?? "Brand not listed"}</span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-flora" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
