"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useAccount } from "./account-provider";

/** Top-right: "Sign in", or your initial when signed in. */
export function AccountButton() {
  const { me, ready } = useAccount();
  const label = me ? `Your account (${me.name || me.email})` : "Sign in";
  return (
    <Link
      href={me ? "/account" : "/account/sign-in"}
      aria-label={label}
      title={label}
      className="pointer-events-auto glass grid h-11 min-w-11 place-items-center rounded-full px-3 text-[14px] font-medium text-ink transition hover:bg-white/80"
    >
      {ready && me ? <span className="font-display text-[1.15rem] leading-none">{(me.name || me.email).trim().charAt(0).toUpperCase()}</span> : <UserRound className="h-5 w-5" />}
    </Link>
  );
}
