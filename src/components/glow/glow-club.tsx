"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarHeart, Check, Copy, Crown, Gift, Loader2, Lock, ShieldCheck, Sparkles, Ticket, UserPlus } from "lucide-react";
import { useBooking } from "@/components/booking/booking";
import { openLiveScan } from "@/components/scan/open-live-scan";
import { EARN, REWARDS, TIERS, nextTier, tierFor, type EarnKey } from "@/content/club";
import { EMPTY_CLUB, KEYS, award, balance, earned, getClub, lifetime, redeem, useStored, type Club, type ClubRedeem } from "@/lib/glow-store";
import { shortDate } from "@/lib/ics";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Glow Club: points for scans, plans, visits and friends, traded for rewards at the front desk.
 * Points are kept on this phone (no account, nothing sent to NEA); the clinic confirms every reward.
 */
export function GlowClub() {
  const [club, , ready] = useStored<Club>(KEYS.club, EMPTY_CLUB);
  const [codesOn, setCodesOn] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [ticket, setTicket] = useState<ClubRedeem | null>(null);
  const [copied, setCopied] = useState(false);
  const book = useBooking();

  // make sure this phone has its member code, and learn whether clinic codes are switched on
  useEffect(() => {
    getClub();
    fetch("/api/club")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCodesOn(Boolean(d?.codes)))
      .catch(() => {});
  }, []);

  const total = lifetime(club);
  const have = balance(club);
  const tier = tierFor(total);
  const next = nextTier(total);
  const link = `${site.url}/free-scan?ref=${club.me}`;

  const share = async () => {
    const text = "Get a free skin scan at NEA Precision Skin. It shows your skin in 8 kinds of light.";
    try {
      if (navigator.share) await navigator.share({ title: "Free skin scan at NEA", text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      award("share");
    } catch {
      /* the visitor closed the share sheet */
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setCodeMsg(null);
    try {
      const res = await fetch("/api/club", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; pts?: number; label?: string; code?: string; error?: string };
      if (!res.ok || !d.ok || !d.pts) setCodeMsg({ ok: false, text: d.error ?? "That code didn't work." });
      else {
        const got = award("code", { pts: d.pts, label: d.label, code: d.code });
        setCodeMsg(got ? { ok: true, text: `+${got} points added. Thank you for visiting.` } : { ok: false, text: "You already used this code today." });
        if (got) setCode("");
      }
    } catch {
      setCodeMsg({ ok: false, text: "We couldn't check the code. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const doRedeem = (r: (typeof REWARDS)[number]) => {
    const t = redeem(r);
    setConfirm(null);
    if (t) setTicket(t);
  };

  if (!ready) return <div className="surface h-64 animate-pulse rounded-[32px]" aria-hidden />;

  return (
    <div className="space-y-5">
      {/* the card */}
      <section className="relative overflow-hidden rounded-[32px] bg-ink p-6 text-white md:p-9" aria-label="Your Glow Club card">
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: "var(--aurora)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[13px] text-white/70">
              <Crown className="h-4 w-4 text-dermis" /> Glow Club · {tier.name}
            </p>
            <p className="tabular mt-2 font-display text-[clamp(3.4rem,14vw,5.5rem)] leading-none">{have}</p>
            <p className="text-[15px] text-white/75">Glow points to spend</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Your code</p>
            <p className="tabular font-mono text-[1.25rem] tracking-[0.18em]">{club.me || "······"}</p>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="flex justify-between text-[12.5px] text-white/70">
            <span>{tier.perk}</span>
            <span className="tabular">{next ? `${next.from - total} to ${next.name}` : "Top level"}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={next?.from ?? total} aria-valuenow={total} aria-label="Progress to the next level">
            <motion.div className="h-full rounded-full" style={{ background: "var(--aurora)" }} initial={{ width: 0 }} animate={{ width: `${next ? Math.min(100, ((total - tier.from) / (next.from - tier.from)) * 100) : 100}%` }} transition={{ duration: 0.9 }} />
          </div>
          <ol className="mt-2 flex justify-between text-[11.5px] text-white/55">
            {TIERS.map((t) => (
              <li key={t.name} className={cn(total >= t.from && "text-white")}>
                {t.name} · {t.from}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* earn */}
        <section className="surface min-w-0 rounded-[28px] p-5 md:p-7" aria-label="Ways to earn points">
          <h2 className="flex items-center gap-2 font-display text-[1.6rem] text-ink">
            <Sparkles className="h-5 w-5 text-flora" /> Earn points
          </h2>
          <ul className="mt-4 space-y-2">
            {(Object.keys(EARN) as EarnKey[])
              .filter((k) => k !== "code")
              .map((k) => {
                const e = EARN[k];
                const done = earned(club, k);
                const body = (
                  <>
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", done ? "bg-sky text-white" : "bg-flora-soft text-flora")}>{done ? <Check className="h-4 w-4" /> : k === "share" ? <UserPlus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[15px] font-medium text-ink">{e.label}</span>
                      <span className="block text-[13px] leading-snug text-graphite">{done ? (e.limit === "day" ? "Done today. Come back tomorrow." : "Done.") : e.how}</span>
                    </span>
                    <span className="tabular shrink-0 rounded-full bg-ink/[0.05] px-2.5 py-1 text-[13px] font-medium text-ink">+{e.pts}</span>
                  </>
                );
                const cls = "flex w-full items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/70 p-3.5 transition hover:border-ink/15 hover:bg-white";
                return (
                  <li key={k}>
                    {k === "share" ? (
                      <button onClick={share} className={cls}>
                        {body}
                      </button>
                    ) : k === "scan" ? (
                      <button onClick={openLiveScan} className={cls}>
                        {body}
                      </button>
                    ) : (
                      <Link href={e.href!} className={cls}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
          </ul>
          {copied && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-sky" role="status">
              <Copy className="h-3.5 w-3.5" /> Link copied. Paste it in a message to your friend.
            </p>
          )}
          <p className="mt-3 text-[13px] leading-snug text-graphite">
            When your friend books, ask them to give your code <strong className="tabular font-semibold text-ink">{club.me}</strong> at the front desk.
          </p>

          {codesOn && (
            <form onSubmit={submitCode} className="mt-5 rounded-2xl border border-ink/[0.07] bg-white/70 p-4">
              <label htmlFor="club-code" className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
                <Ticket className="h-4 w-4 text-flora" /> Have a code from the front desk?
              </label>
              <div className="mt-2 flex gap-2">
                <input id="club-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} placeholder="Type your code" className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-[15px] tracking-wider text-ink outline-none focus:border-flora" />
                <button disabled={busy || !code.trim()} className="btn-light shrink-0 !px-5 !py-2.5 !text-[14.5px] disabled:opacity-40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </button>
              </div>
              {codeMsg && (
                <p className={cn("mt-2 text-[13.5px]", codeMsg.ok ? "text-sky" : "text-flora")} role="status">
                  {codeMsg.text}
                </p>
              )}
            </form>
          )}
        </section>

        {/* spend */}
        <section className="surface min-w-0 rounded-[28px] p-5 md:p-7" aria-label="Rewards">
          <h2 className="flex items-center gap-2 font-display text-[1.6rem] text-ink">
            <Gift className="h-5 w-5 text-flora" /> Rewards
          </h2>
          <ul className="mt-4 space-y-2">
            {REWARDS.map((r) => {
              const can = have >= r.pts;
              return (
                <li key={r.id} className={cn("rounded-2xl border p-3.5", can ? "border-flora/30 bg-white" : "border-ink/[0.06] bg-white/60")}>
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", can ? "bg-flora-soft text-flora" : "bg-ink/[0.05] text-graphite")}>{can ? <Gift className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">{r.name}</span>
                      <span className="block text-[13px] leading-snug text-graphite">{r.detail}</span>
                    </span>
                    <span className="tabular shrink-0 text-[13px] font-medium text-ink">{r.pts} pts</span>
                  </div>
                  {can ? (
                    confirm === r.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                        <span className="text-graphite">Use {r.pts} points now?</span>
                        <button onClick={() => doRedeem(r)} className="btn-light !px-4 !py-2 !text-[14px]">
                          Yes, get it
                        </button>
                        <button onClick={() => setConfirm(null)} className="text-graphite underline-offset-4 hover:underline">
                          Not yet
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirm(r.id)} className="btn-ghost mt-3 w-full !py-2.5 !text-[14.5px]">
                        Get this reward
                      </button>
                    )
                  ) : (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                        <div className="h-full rounded-full bg-flora/60" style={{ width: `${Math.min(100, (have / r.pts) * 100)}%` }} />
                      </div>
                      <p className="tabular mt-1 text-[12.5px] text-graphite">{r.pts - have} more points</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {club.redeemed.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] text-graphite">Your rewards</p>
              <ul className="mt-2 space-y-1.5">
                {[...club.redeemed].reverse().map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setTicket(r)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-mist/70 px-3.5 py-2.5 text-left text-[14px] hover:bg-mist">
                      <span className="min-w-0 truncate text-ink">{r.name}</span>
                      <span className="tabular shrink-0 font-mono text-[13px] text-graphite">{r.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* history */}
      {club.ledger.length > 0 && (
        <section className="surface rounded-[28px] p-5 md:p-7" aria-label="Points history">
          <h2 className="font-display text-[1.4rem] text-ink">Points history</h2>
          <ul className="mt-3 divide-y divide-ink/[0.06]">
            {[...club.ledger]
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-[14.5px]">
                  <span className="text-ink">{e.label}</span>
                  <span className="flex shrink-0 items-center gap-3 text-graphite">
                    <span className="text-[13px]">{shortDate(new Date(e.at))}</span>
                    <span className="tabular font-medium text-sky">+{e.pts}</span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="flex gap-2 text-[12.5px] leading-snug text-graphite">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Points are saved on this phone, with no account. If you clear your browser or change phones, they start again. The front desk confirms every reward. One reward per visit. Points have no cash value.
      </p>

      {/* the reward ticket */}
      <AnimatePresence>
        {ticket && (
          <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTicket(null)} role="dialog" aria-modal="true" aria-label="Your reward">
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-[28px] bg-porcelain text-center shadow-2xl">
              <div className="p-6" style={{ background: "var(--aurora)" }}>
                <Gift className="mx-auto h-8 w-8 text-ink" />
                <p className="mt-2 font-display text-[1.7rem] leading-tight text-ink">{ticket.name}</p>
              </div>
              <div className="p-6">
                <p className="text-[14px] text-graphite">Show this screen at the front desk</p>
                <p className="tabular mt-2 rounded-2xl border-2 border-dashed border-ink/20 py-3 font-mono text-[1.6rem] tracking-[0.14em] text-ink">{ticket.code}</p>
                <p className="mt-2 text-[12.5px] text-graphite">Got on {shortDate(new Date(ticket.at))}. The front desk confirms it when you visit.</p>
                <button onClick={() => (setTicket(null), book.open(REWARDS.find((r) => r.id === ticket.reward)?.book ?? "skin-scan", ticket.name))} className="btn-light mt-4 w-full">
                  <CalendarHeart className="h-4 w-4" /> Book my visit
                </button>
                <button onClick={() => setTicket(null)} className="mt-3 inline-flex items-center gap-1 text-[14px] text-graphite underline-offset-4 hover:underline">
                  Close <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
