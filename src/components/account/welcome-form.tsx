"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { track } from "@/lib/analytics";
import { useAccount } from "./account-provider";
import { safeNext } from "./sign-in-flow";

/** The short "about you" step for new people: name, birth month, consent, and a parent's email if under 18. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MIN_AGE = 16;

function ageOf(y: number, m: number) {
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 <= m) a--; // birthday counted once the birth month is over (same as the server)
  return a;
}

export function WelcomeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = typeof window === "undefined" ? "/account" : safeNext(params.get("next"));
  const { refresh } = useAccount();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/complete", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { email: string | null; name?: string }) => {
        setEmail(d.email);
        if (d.name) setName(d.name);
      })
      .catch(() => setEmail(null));
  }, []);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 95 }, (_, i) => y - 13 - i);
  }, []);
  const age = year && month ? ageOf(Number(year), Number(month)) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const minor = age !== null && age >= MIN_AGE && age < 18;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || tooYoung) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, birthYm: `${year}-${month.padStart(2, "0")}`, privacy, marketing: minor ? false : marketing, parentEmail: minor ? parentEmail : undefined }),
      });
      const d = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "Please check the form.");
      track("signup_finish", { minor: minor });
      await refresh();
      if (d.status === "pending_parent") setWaiting(true);
      else router.push(next);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Please check the form.");
    } finally {
      setBusy(false);
    }
  };

  const box = "mt-1.5 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-flora focus:ring-2 focus:ring-flora/15";

  if (email === undefined) return <div className="surface mx-auto h-80 max-w-md animate-pulse rounded-[32px]" aria-hidden />;
  if (email === null)
    return (
      <div className="mx-auto max-w-md rounded-[32px] border border-ink/10 bg-white/75 p-8 text-center">
        <h1 className="font-display text-[2rem]">Let's start again.</h1>
        <p className="mt-2 text-graphite">Your sign-up timed out after 30 minutes.</p>
        <Link href="/account/sign-in" className="btn-primary mt-5 inline-flex">
          Sign in or join
        </Link>
      </div>
    );
  if (waiting)
    return (
      <div className="mx-auto max-w-md rounded-[32px] border border-ink/10 bg-white/75 p-8">
        <MailCheck className="h-8 w-8 text-flora" />
        <h1 className="mt-3 font-display text-[2rem] leading-tight">We emailed your parent.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">
          You're under 18, so a parent needs to say yes first. Once they do, your account turns on. If they don't answer in 7 days, we delete it.
        </p>
        <Link href="/" className="btn-ghost mt-5 inline-flex">
          Back to the site
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4 rounded-[32px] border border-ink/10 bg-white/75 p-6 backdrop-blur md:p-8">
      <div>
        <h1 className="font-display text-[2.2rem] leading-tight">Nice to meet you.</h1>
        <p className="mt-2 text-[15px] text-graphite">
          A few details for <strong className="text-ink">{email}</strong>.
        </p>
      </div>
      <label className="block">
        <span className="text-[13px] text-graphite">Your first name</span>
        <input required maxLength={80} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={box} />
      </label>
      <fieldset>
        <legend className="text-[13px] text-graphite">Birth month and year</legend>
        <div className="grid grid-cols-2 gap-2">
          <select required value={month} onChange={(e) => setMonth(e.target.value)} className={box} aria-label="Birth month">
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <select required value={year} onChange={(e) => setYear(e.target.value)} className={box} aria-label="Birth year">
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1.5 text-[12.5px] text-graphite">We ask because accounts are for people {MIN_AGE} and older, and under 18 needs a parent's OK.</p>
      </fieldset>
      {tooYoung && (
        <p role="alert" className="rounded-2xl bg-flora-soft px-4 py-3 text-[14px]">
          Sorry, you need to be {MIN_AGE} or older to make an account. You can still use the free face scan and ask Nea SI.
        </p>
      )}
      {minor && (
        <label className="block">
          <span className="text-[13px] text-graphite">A parent's email</span>
          <input required type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={box} placeholder="parent@example.com" />
          <span className="mt-1.5 block text-[12.5px] text-graphite">You're under 18, so we'll ask a parent to say yes. Nothing is saved until they do.</span>
        </label>
      )}
      <label className="flex items-start gap-3 text-[14px] leading-relaxed">
        <input type="checkbox" required checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--c-accent))]" />
        <span>
          I agree to the{" "}
          <Link href="/privacy" className="underline underline-offset-2" target="_blank">
            privacy policy
          </Link>
          . NEA keeps my scan numbers and plans, never my face photos.
        </span>
      </label>
      {!minor && (
        <label className="flex items-start gap-3 text-[14px] leading-relaxed">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--c-accent))]" />
          <span>Send me offers and skin tips by email (optional, stop any time).</span>
        </label>
      )}
      <button type="submit" disabled={busy || tooYoung || !privacy} className="btn-primary w-full justify-center disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create my free account
      </button>
      {msg && (
        <p role="alert" className="rounded-2xl bg-flora-soft px-4 py-3 text-[14px]">
          {msg}
        </p>
      )}
    </form>
  );
}
