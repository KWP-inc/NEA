"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { solveCaptcha } from "@/lib/captcha-client";
import { track } from "@/lib/analytics";
import { useAccount } from "./account-provider";

/**
 * Sign in or create an account, one screen at a time:
 *   1. Email → we send a 6-digit code (or: Continue with Google / Apple)
 *   2. Type the code
 *   3. New here? → the short "about you" form (/account/welcome)
 */
/** Only pages on this site: the URL is resolved by the browser and its origin must be ours (stops /\evil.com tricks). */
export function safeNext(n: string | null) {
  if (!n || n.length > 200 || !/^\/[\w\-/?=&.#%]*$/.test(n)) return "/account";
  try {
    const u = new URL(n, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : "/account";
  } catch {
    return "/account";
  }
}

export function SignInFlow() {
  const params = useSearchParams();
  const next = typeof window === "undefined" ? "/account" : safeNext(params.get("next"));
  const router = useRouter();
  const { refresh, providers, accounts, ready } = useAccount();
  const [mode, setMode] = useState<"signin" | "join">(params.get("mode") === "join" ? "join" : "signin");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(
    params.get("error") === "staff" ? "Staff accounts sign in with the email code, not Google or Apple." : params.get("error") ? "That sign-in didn't finish. Please try again." : "",
  );
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("nea-next", next);
    } catch {
      /* private mode */
    }
  }, [next]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const captcha = await solveCaptcha();
      const res = await fetch("/api/auth/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, captcha }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "We couldn't send a code. Try again.");
      track("signup_start", { method: "email" });
      setStep("code");
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "We couldn't send a code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) });
      const d = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "That code didn't work.");
      // a new email (or "Sign in" with an email that has no account yet) goes on to the short sign-up form
      if (d.status === "needs-profile") return router.push(`/account/welcome?next=${encodeURIComponent(next)}${mode === "signin" ? "&new=1" : ""}`);
      track("signin", { method: "email" });
      await refresh();
      router.push(next);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That code didn't work.");
      setDigits(["", "", "", "", "", ""]);
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (i: number, v: string) => {
    const only = v.replace(/\D/g, "");
    if (only.length > 1) {
      // pasted the whole code
      const all = only.slice(0, 6).split("");
      const d = [...digits];
      all.forEach((c, k) => (d[k] = c));
      setDigits(d);
      if (d.every(Boolean)) void verify(d.join(""));
      return;
    }
    const d = [...digits];
    d[i] = only;
    setDigits(d);
    if (only && i < 5) boxes.current[i + 1]?.focus();
    if (d.every(Boolean)) void verify(d.join(""));
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-[32px] border border-ink/10 bg-white/75 p-6 shadow-sm backdrop-blur md:p-8">
      {ready && !accounts ? (
        <>
          <h1 className="font-display text-[2.2rem] leading-tight">Accounts open soon.</h1>
          <p className="mt-2 text-[15px] text-graphite">
            Member accounts aren't switched on for this site yet. You can still use every free tool: the live face scan, Skin Lens, Nea SI and booking.
          </p>
        </>
      ) : step === "email" ? (
        <>
          <div role="tablist" aria-label="Sign in or create an account" className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1">
            {(
              [
                ["signin", "Sign in", KeyRound],
                ["join", "Create account", UserPlus],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => (setMode(m), setMsg(""))}
                className={cn("flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[14px] font-medium transition", mode === m ? "bg-white text-ink shadow-sm" : "text-graphite hover:text-ink")}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <h1 className="font-display text-[2.2rem] leading-tight">{mode === "signin" ? "Welcome back." : "Create your free account."}</h1>
          <p className="mt-2 text-[15px] text-graphite">
            {mode === "signin"
              ? "Enter the email you joined with. We'll email you a 6-digit code to sign in. No password to remember."
              : "Start with your email. We'll send a 6-digit code to check it's yours, then ask three quick questions."}
          </p>
          <form onSubmit={sendCode} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-[13px] text-graphite">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-flora focus:ring-2 focus:ring-flora/15"
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" disabled={busy || !email} className="btn-primary w-full justify-center disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {mode === "signin" ? "Email me a sign-in code" : "Email me a code to start"}
            </button>
          </form>
          {(providers.google || providers.apple) && (
            <>
              <div className="my-5 flex items-center gap-3 text-[12px] text-graphite">
                <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
              </div>
              <div className="grid gap-2">
                {providers.google && (
                  <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} onClick={() => track("signup_start", { method: "google" })} className="btn-ghost w-full justify-center">
                    Continue with Google
                  </a>
                )}
                {providers.apple && (
                  <a href={`/api/auth/apple?next=${encodeURIComponent(next)}`} onClick={() => track("signup_start", { method: "apple" })} className="btn-ghost w-full justify-center">
                    Continue with Apple
                  </a>
                )}
              </div>
            </>
          )}
          <p className="mt-5 text-[13.5px] text-graphite">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button onClick={() => setMode("join")} className="font-medium text-flora underline-offset-2 hover:underline">
                  Create a free account
                </button>
              </>
            ) : (
              <>
                Already a member?{" "}
                <button onClick={() => setMode("signin")} className="font-medium text-flora underline-offset-2 hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-[2.2rem] leading-tight">Check your email.</h1>
          <p className="mt-2 text-[15px] text-graphite">
            We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It works for 10 minutes.
          </p>
          <div className="mt-6 flex justify-between gap-2" role="group" aria-label="6-digit code">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={d}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && boxes.current[i - 1]?.focus()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                aria-label={`Digit ${i + 1}`}
                className="h-14 w-full rounded-2xl border border-ink/15 bg-white text-center text-[22px] font-semibold outline-none focus:border-flora focus:ring-2 focus:ring-flora/15"
              />
            ))}
          </div>
          {busy && (
            <p className="mt-4 flex items-center gap-2 text-[14px] text-graphite">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking…
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2 text-[14px]">
            <button type="button" onClick={() => sendCode()} disabled={busy} className="btn-ghost !py-2">
              Send a new code
            </button>
            <button type="button" onClick={() => setStep("email")} className="btn-ghost !py-2">
              Use another email
            </button>
          </div>
        </>
      )}
      {msg && (
        <p role="alert" className="mt-4 rounded-2xl bg-flora-soft px-4 py-3 text-[14px] text-ink">
          {msg}
        </p>
      )}
      <p className="mt-6 flex items-start gap-2 text-[12.5px] text-graphite">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> We never save face photos. You can download or delete your data any time.
      </p>
    </div>
  );
}
