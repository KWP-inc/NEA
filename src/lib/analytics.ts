"use client";
import type { EventName } from "./analytics-events";

/**
 * First-party analytics: no Google Analytics, no Meta pixel, nothing sent to a third party.
 * Only runs after the visitor taps "Allow" in the cookie banner, and respects Do Not Track.
 * Events are batched and sent every few seconds, and once more when the page is closed.
 */
export const CONSENT_KEY = "nea-consent"; // "all" | "essential"
const ANON_KEY = "nea-anon";
const SID_KEY = "nea-sid";
const UTM_KEY = "nea-utm";

type Ev = { name: EventName; path: string; props?: Record<string, string | number | boolean>; t: number };
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function consent(): "all" | "essential" | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: "all" | "essential") {
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
    if (v === "essential") {
      window.localStorage.removeItem(ANON_KEY);
      queue = [];
    }
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("nea:consent", { detail: v }));
}

const rid = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);

function ids() {
  let anon = window.localStorage.getItem(ANON_KEY);
  if (!anon) window.localStorage.setItem(ANON_KEY, (anon = rid()));
  let sid = window.sessionStorage.getItem(SID_KEY);
  if (!sid) window.sessionStorage.setItem(SID_KEY, (sid = rid()));
  return { anon, sid };
}

function utm(): Record<string, string> {
  try {
    const saved = window.sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved);
    const q = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"]) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 100);
    }
    window.sessionStorage.setItem(UTM_KEY, JSON.stringify(out));
    return out;
  } catch {
    return {};
  }
}

function allowed() {
  if (typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1") return false;
  if ((window as unknown as { __neaNoTrack?: boolean }).__neaNoTrack) return false;
  return consent() === "all";
}

function flush(final = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length || !allowed()) return;
  const events = queue.splice(0, 30);
  const { anon, sid } = ids();
  const body = JSON.stringify({ anon, sid, utm: utm(), ref: document.referrer ? document.referrer.slice(0, 300) : undefined, events });
  fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: final, credentials: "same-origin" }).catch(() => {});
  if (queue.length) flush(final);
}

export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  if (!allowed()) return;
  queue.push({ name, path: window.location.pathname.slice(0, 200), props, t: Date.now() });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(() => flush(), 5000);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush(true));
}
