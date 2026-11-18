"use client";
import { useState } from "react";
import { useAccount } from "./account-provider";
import { JoinCard } from "./join-card";

/** Free tools work for everyone; this tells visitors that keeping the result needs a free account. */
export function GuestSaveNotice({ what }: { what: string }) {
  const { me, ready } = useAccount();
  const [hide, setHide] = useState(false);
  if (!ready || me || hide) return null;
  return (
    <JoinCard
      compact
      className="mb-6"
      title={`Try it free. Save your ${what} with a free account.`}
      text={`Without an account, your ${what} is kept only on this phone. With one, it's saved safely and you earn Glow Club points.`}
      onClose={() => setHide(true)}
    />
  );
}
