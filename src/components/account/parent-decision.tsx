"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { solveCaptcha } from "@/lib/captcha-client";

export function ParentDecision({ t }: { t: string }) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [done, setDone] = useState<string>("");
  const decide = async (yes: boolean) => {
    setBusy(yes ? "yes" : "no");
    try {
      const captcha = await solveCaptcha();
      const res = await fetch("/api/auth/parent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t, yes, captcha }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setDone(res.ok ? (yes ? "Thank you. The account is now on." : "Done. The account has been deleted.") : d.error || "Something went wrong.");
    } catch {
      setDone("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  if (done)
    return (
      <p role="status" className="mt-5 rounded-2xl bg-flora-soft px-4 py-3 text-[15px]">
        {done}
      </p>
    );
  return (
    <div className="mt-6 grid gap-2">
      <button onClick={() => decide(true)} disabled={Boolean(busy)} className="btn-primary justify-center">
        {busy === "yes" && <Loader2 className="h-4 w-4 animate-spin" />} Yes, I agree
      </button>
      <button onClick={() => decide(false)} disabled={Boolean(busy)} className="btn-ghost justify-center">
        {busy === "no" && <Loader2 className="h-4 w-4 animate-spin" />} No, delete the account
      </button>
    </div>
  );
}
