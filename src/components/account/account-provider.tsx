"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { connectAccount, forgetDevice, setAccountMode } from "@/lib/glow-store";

/**
 * Who is signed in, for the whole site. Asks the server once per page load (the session cookie is HttpOnly,
 * so JavaScript can't read it; only the server can say who you are).
 */
export type Me = { name: string; email: string; role: "member" | "staff" | "admin"; status: "active" | "pending_parent" | "disabled"; marketing: boolean; clubCode: string; mfaOk: boolean };
type Ctx = { me: Me | null; ready: boolean; accounts: boolean; providers: { google: boolean; apple: boolean }; refresh: () => Promise<void>; signOut: () => Promise<void> };

const AccountCtx = createContext<Ctx>({ me: null, ready: false, accounts: true, providers: { google: false, apple: false }, refresh: async () => {}, signOut: async () => {} });
export const useAccount = () => useContext(AccountCtx);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [accounts, setAccounts] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      const d = (await res.json()) as { user: Me | null; providers: { google: boolean; apple: boolean }; accounts?: boolean };
      setMe(d.user);
      setAccounts(d.accounts !== false);
      setProviders(d.providers ?? { google: false, apple: false });
      if (d.user?.status === "active") await connectAccount(d.user.clubCode);
      else if (d.user) setAccountMode("guest");
      else {
        // signed out (or the session ended): don't leave the last person's data on this phone
        if (window.localStorage.getItem("nea-synced-for")) forgetDevice();
        else setAccountMode("guest");
      }
    } catch {
      setAccountMode("guest");
      setAccounts(false);
    } finally {
      setReady(true);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    forgetDevice();
    setMe(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <AccountCtx.Provider value={{ me, ready, accounts, providers, refresh, signOut }}>{children}</AccountCtx.Provider>;
}
