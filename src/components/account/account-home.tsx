"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookHeart, CalendarHeart, Crown, Download, FlaskConical, Loader2, LogOut, Shield, Sparkles, Syringe, Trash2 } from "lucide-react";
import { openLiveScan } from "@/components/scan/open-live-scan";
import { useAccount } from "./account-provider";

/** Your account: My Glow shortcuts, your details, consents, download and delete. */
export function AccountHome({ staffHref }: { staffHref: string | null }) {
  const { me, ready, refresh, signOut } = useAccount();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [del, setDel] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!ready) return <div className="surface h-80 animate-pulse rounded-[32px]" aria-hidden />;
  if (!me)
    return (
      <div className="rounded-[32px] border border-ink/10 bg-white/75 p-8 text-center">
        <p className="text-graphite">You're signed out.</p>
        <Link href="/account/sign-in" className="btn-primary mt-4 inline-flex">
          Sign in or join free
        </Link>
      </div>
    );

  const patch = async (body: Record<string, unknown>, done: string) => {
    setSaving(true);
    setNote("");
    const res = await fetch("/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    setNote(res.ok ? done : d.error || "Couldn't save. Try again.");
    if (res.ok) await refresh();
  };

  const remove = async () => {
    setDeleting(true);
    const res = await fetch("/api/me/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: del }) });
    setDeleting(false);
    if (res.ok) {
      await signOut();
      router.push("/?deleted=1");
    } else setNote("Type DELETE in capitals to confirm.");
  };

  const tools = [
    { href: "/skin-diary", icon: BookHeart, label: "Skin Diary", text: "Your scans over time" },
    { href: "/glow-club", icon: Crown, label: "Glow Club", text: "Points and rewards" },
    { href: "/routine", icon: FlaskConical, label: "Routine Builder", text: "Your products, in order" },
    { href: "/countdown", icon: CalendarHeart, label: "Event Countdown", text: "Plan for a big day" },
    { href: "/injectables", icon: Syringe, label: "Injectables Planner", text: "Areas and top-up dates" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] bg-ink p-6 text-white md:p-9">
        <p className="text-[13px] text-white/70">Signed in as {me.email}</p>
        <h1 className="mt-1 font-display text-[clamp(2.2rem,8vw,3.2rem)] leading-tight">Hi {me.name || "there"}.</h1>
        {me.status === "pending_parent" ? (
          <p className="mt-2 text-white/80">We're waiting for your parent to say yes. Your tools turn on once they do.</p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => openLiveScan()} className="btn-light">
              <Sparkles className="h-4 w-4" /> Scan my face
            </button>
            {staffHref && (
              <Link href={staffHref} className="btn-ghost !border-white/30 !text-white">
                <Shield className="h-4 w-4" /> Staff page
              </Link>
            )}
          </div>
        )}
      </section>

      {me.status === "active" && (
        <section aria-label="My Glow tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ href, icon: I, label, text }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-3xl border border-ink/10 bg-white/70 p-4 transition hover:bg-white">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-flora-soft">
                <I className="h-5 w-5 text-flora" />
              </span>
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-[13.5px] text-graphite">{text}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="rounded-[28px] border border-ink/10 bg-white/70 p-6">
        <h2 className="text-[17px] font-semibold">Your details</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name && name.trim()) void patch({ name: name.trim() }, "Name saved.");
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="text-[13px] text-graphite">First name</span>
            <input
              value={name ?? me.name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1.5 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-[16px] outline-none focus:border-flora"
            />
          </label>
          <button type="submit" disabled={saving} className="btn-ghost">
            Save
          </button>
        </form>
        <label className="mt-5 flex items-start gap-3 text-[14.5px]">
          <input type="checkbox" checked={me.marketing} onChange={(e) => void patch({ marketing: e.target.checked }, e.target.checked ? "You'll get offers by email." : "No more offer emails.")} className="mt-1 h-5 w-5 accent-[rgb(var(--c-accent))]" />
          <span>Email me offers and skin tips. You can stop any time.</span>
        </label>
        <p className="mt-3 text-[13.5px] text-graphite">Your Glow Club code: <strong className="text-ink">{me.clubCode}</strong></p>
        {note && (
          <p role="status" className="mt-3 text-[14px] text-flora">
            {note}
          </p>
        )}
      </section>

      <section className="rounded-[28px] border border-ink/10 bg-white/70 p-6">
        <h2 className="text-[17px] font-semibold">Your data</h2>
        <p className="mt-1 text-[14px] text-graphite">We keep your scan numbers, plans and points. Never your face photos.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/me/export" className="btn-ghost">
            <Download className="h-4 w-4" /> Download my data
          </a>
          <button onClick={() => void signOut().then(() => router.push("/"))} className="btn-ghost">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        {me.role === "member" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-4">
            <p className="flex items-center gap-2 text-[14.5px] font-medium text-red-800">
              <Trash2 className="h-4 w-4" /> Delete my account
            </p>
            <p className="mt-1 text-[13.5px] text-red-900/80">This deletes your account, scans, plans and points for good. Type DELETE to confirm.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={del} onChange={(e) => setDel(e.target.value)} aria-label="Type DELETE to confirm" className="rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-[15px]" placeholder="DELETE" />
              <button onClick={remove} disabled={del !== "DELETE" || deleting} className="rounded-full bg-red-700 px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete for good"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
