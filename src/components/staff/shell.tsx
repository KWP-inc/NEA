"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Gift, Inbox, KeyRound, Loader2, LogOut, ScrollText, ShieldCheck, Users, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const BaseCtx = createContext("/");
export const useBase = () => useContext(BaseCtx);

export async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Error ${res.status}`);
  return res.json() as Promise<T>;
}
export async function sendJSON<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error || `Error ${res.status}`);
  return d as T;
}

/** The staff page frame: a calm sidebar (tabs on phones), and the two-step sign-in gate. */
export function StaffShell({ base, role, mfaOk, email, children }: { base: string; role: "staff" | "admin"; mfaOk: boolean; email: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    // staff pages are never counted in visitor analytics
    (window as unknown as { __neaNoTrack?: boolean }).__neaNoTrack = true;
  }, []);
  const nav = [
    { href: base, icon: BarChart3, label: "Overview" },
    { href: `${base}/members`, icon: Users, label: "Members" },
    { href: `${base}/leads`, icon: Inbox, label: "Leads" },
    { href: `${base}/rewards`, icon: Gift, label: "Rewards" },
    ...(role === "admin"
      ? [
          { href: `${base}/team`, icon: UserCog, label: "Staff" },
          { href: `${base}/audit`, icon: ScrollText, label: "Audit log" },
        ]
      : []),
  ];
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };
  return (
    <BaseCtx.Provider value={base}>
      <div className="fixed inset-0 z-[95] overflow-y-auto bg-porcelain text-ink" data-lenis-prevent>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-porcelain/90 px-4 py-3 backdrop-blur md:px-8">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <ShieldCheck className="h-4 w-4 text-flora" /> NEA staff <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white">Staff only</span>
          </p>
          <div className="flex items-center gap-3 text-[13px] text-graphite">
            <span className="hidden sm:inline">{email}</span>
            <button onClick={signOut} className="btn-ghost !px-3 !py-1.5 !text-[13px]">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </header>
        {!mfaOk ? (
          <MfaGate />
        ) : (
          <div className="md:flex">
            <nav className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3 py-2 md:sticky md:top-[57px] md:h-[calc(100svh-57px)] md:self-start md:w-56 md:flex-col md:border-b-0 md:border-r md:px-3 md:py-5">
              {nav.map(({ href, icon: I, label }) => (
                <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[14px]", path === href ? "bg-ink text-white" : "text-graphite hover:bg-ink/5")}>
                  <I className="h-4 w-4" /> {label}
                </Link>
              ))}
            </nav>
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
          </div>
        )}
      </div>
    </BaseCtx.Provider>
  );
}

function MfaGate() {
  const router = useRouter();
  const [st, setSt] = useState<{ state: string; qr?: string; secret?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [backup, setBackup] = useState<string[] | null>(null);
  useEffect(() => {
    getJSON<{ state: string; qr?: string; secret?: string }>("/api/staff/mfa").then(setSt).catch((e) => setErr(String(e.message)));
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await sendJSON<{ backupCodes?: string[] }>("/api/staff/mfa", "POST", { code });
      if (r.backupCodes) setBackup(r.backupCodes);
      else router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  };
  if (backup)
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-ink/10 bg-white p-6">
        <h1 className="text-xl font-semibold">Save your backup codes</h1>
        <p className="mt-2 text-[14px] text-graphite">Each works once if you lose your phone. Keep them somewhere safe. They won't be shown again.</p>
        <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-[14px]">
          {backup.map((c) => (
            <li key={c} className="rounded-lg bg-mist px-3 py-2">
              {c}
            </li>
          ))}
        </ul>
        <button onClick={() => router.refresh()} className="btn-primary mt-5 w-full justify-center">
          I saved them
        </button>
      </div>
    );
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl border border-ink/10 bg-white p-6">
      <p className="flex items-center gap-2 text-[13px] font-medium text-flora">
        <KeyRound className="h-4 w-4" /> Two-step sign-in
      </p>
      {!st ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin" />
      ) : st.state === "ready" ? (
        <h1 className="mt-2 text-xl font-semibold">Enter the code from your authenticator app.</h1>
      ) : (
        <>
          <h1 className="mt-2 text-xl font-semibold">Set up your authenticator app.</h1>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] text-graphite">
            <li>Open Google Authenticator, Microsoft Authenticator or 1Password.</li>
            <li>Scan this code (or type the key).</li>
            <li>Type the 6-digit number it shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {st.qr && <img src={st.qr} alt="QR code for your authenticator app" className="mx-auto mt-4 h-52 w-52" />}
          {st.secret && <p className="mt-2 break-all text-center font-mono text-[12px] text-graphite">{st.secret}</p>}
        </>
      )}
      <form onSubmit={submit} className="mt-5 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Code" className="min-w-0 flex-1 rounded-2xl border border-ink/15 px-4 py-3 text-[18px] tracking-widest" />
        <button disabled={busy || code.length < 6} className="btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </button>
      </form>
      {err && <p className="mt-3 text-[14px] text-red-700">{err}</p>}
      <p className="mt-4 text-[12.5px] text-graphite">Lost your phone? Type a backup code instead, or ask an admin to reset your two-step sign-in.</p>
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-ink/10 bg-white/80 p-5", className)}>
      {title && <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "—");
