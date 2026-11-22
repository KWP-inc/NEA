"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BookHeart, Crown, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useAccount } from "./account-provider";

/** The soft "create a free account" card shown after a free tool, and on members-only tools. */
export function JoinCard({ title, text, onClose, compact, className }: { title?: string; text?: string; onClose?: () => void; compact?: boolean; className?: string }) {
  const path = usePathname();
  useEffect(() => track("join_prompt_view", { where: path || "" }), [path]);
  const href = `/account/sign-in?next=${encodeURIComponent(path || "/account")}`;
  const { accounts } = useAccount();
  if (!accounts) return null; // accounts not switched on for this site yet: don't offer them
  return (
    <div className={cn("rounded-[28px] border border-flora/20 bg-flora-soft p-5 text-ink md:p-7", className)} role="region" aria-label="Create a free account">
      <p className="flex items-center gap-2 text-[13px] font-medium text-flora">
        <Sparkles className="h-4 w-4" /> Free NEA account
      </p>
      <h3 className="mt-2 font-display text-[1.7rem] leading-tight">{title ?? "Create a free account to save this."}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-graphite">{text ?? "Keep your scans in your Skin Diary, earn Glow Club points and save your plans. It takes one minute."}</p>
      {!compact && (
        <ul className="mt-4 grid gap-2 text-[14px] text-graphite sm:grid-cols-3">
          <li className="flex items-center gap-2"><BookHeart className="h-4 w-4 text-flora" /> Skin Diary</li>
          <li className="flex items-center gap-2"><Crown className="h-4 w-4 text-flora" /> Glow Club points</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-flora" /> Photos never saved</li>
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`${href}&mode=join`} onClick={() => track("join_prompt_click", { where: path || "" })} className="btn-primary">
          <UserPlus className="h-4 w-4" /> Create free account
        </Link>
        <Link href={`${href}&mode=signin`} className="btn-ghost">
          Sign in
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-ghost">
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
