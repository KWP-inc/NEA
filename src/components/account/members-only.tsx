"use client";
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { useAccount } from "./account-provider";
import { JoinCard } from "./join-card";

/** Shows a My Glow tool to members; visitors see what it does and a free sign-up card. */
export function MembersOnly({ feature, text, children }: { feature: string; text: string; children: ReactNode }) {
  const { me, ready, accounts } = useAccount();
  if (!ready) return <div className="surface h-64 animate-pulse rounded-[32px]" aria-hidden />;
  if (me?.status === "pending_parent")
    return (
      <div className="rounded-[28px] border border-ink/10 bg-white/70 p-6 md:p-8">
        <p className="flex items-center gap-2 text-[13px] font-medium text-flora">
          <Clock className="h-4 w-4" /> Waiting for a parent
        </p>
        <h3 className="mt-2 font-display text-[1.7rem] leading-tight">We emailed your parent.</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">Once they say yes, your {feature} turns on. If they don't answer in 7 days, the account is deleted.</p>
      </div>
    );
  // a site without accounts switched on (for example a preview copy): the tool still works and saves on this device only
  if (!me && ready && !accounts)
    return (
      <>
        <p className="mb-4 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[13.5px] text-graphite">Saved on this device only. Member accounts are coming soon.</p>
        {children}
      </>
    );
  if (!me) return <JoinCard title={`Your ${feature} needs a free account.`} text={text} />;
  return <>{children}</>;
}
