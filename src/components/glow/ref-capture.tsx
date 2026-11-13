"use client";
import { useEffect } from "react";
import { KEYS } from "@/lib/glow-store";

/** Remembers a friend's Glow Club code from a shared link (?ref=ABC123) so it can travel with a booking request. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      if (ref) window.localStorage.setItem(KEYS.ref, ref);
    } catch {
      /* private mode: skip */
    }
  }, []);
  return null;
}
