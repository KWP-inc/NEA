"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { consent, setConsent, track } from "@/lib/analytics";

/**
 * Cookie choice. "Only essential" keeps sign-in and the site working; "Allow" also turns on NEA's own
 * visit counts (no ad trackers either way). Also records page views once allowed.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);
  const path = usePathname();
  useEffect(() => setShow(consent() === null), []);
  useEffect(() => {
    if (path) track("page_view");
  }, [path]);
  if (!show) return null;
  const pick = (v: "all" | "essential") => {
    setConsent(v);
    setShow(false);
    if (v === "all") track("page_view");
  };
  return (
    <div className="fixed inset-x-3 bottom-[92px] z-[80] mx-auto max-w-lg rounded-3xl border border-ink/10 bg-porcelain/95 p-4 text-ink shadow-xl backdrop-blur-md md:bottom-6" role="dialog" aria-label="Cookie choice">
      <p className="flex items-start gap-2 text-[14px] leading-relaxed">
        <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-flora" />
        <span>
          We use cookies to keep you signed in. With your OK, we also count visits to make the site better. No ads, no selling.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </span>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => pick("all")} className="btn-primary flex-1 justify-center !py-2.5">
          Allow
        </button>
        <button type="button" onClick={() => pick("essential")} className="btn-ghost flex-1 justify-center !py-2.5">
          Only essential
        </button>
      </div>
    </div>
  );
}
