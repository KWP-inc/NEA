"use client";
/**
 * "My Glow" data: the Skin Diary, routine, event plan, injectables plan and Glow Club points.
 *
 * Members (signed in): the account on NEA's server is the real copy. This phone keeps a working copy
 * (so screens are instant and work offline for a moment) and every change is sent to the account.
 * Points and rewards are decided by the server. Face photos are NEVER sent: a diary photo stays on this phone only.
 *
 * Visitors (not signed in): they can try the scan and the tools, but saving needs a free account.
 */
import { useCallback, useEffect, useState } from "react";
import { EARN, type EarnKey } from "@/content/club";

export const KEYS = { diary: "nea-diary-v1", routine: "nea-routine-v1", event: "nea-event-v1", plan: "nea-injectables-v1", club: "nea-club-v1", ref: "nea-ref" } as const;
const EVT = "nea:store";
const PENDING_SCAN = "nea-pending-scan";
const SYNCED_FOR = "nea-synced-for";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ───────── Account mode ───────── */

type Mode = "unknown" | "guest" | "member";
let mode: Mode = "unknown";
const MODE_EVT = "nea:mode";
export const accountMode = () => mode;
export function setAccountMode(m: Mode) {
  if (mode === m) return;
  mode = m;
  window.dispatchEvent(new CustomEvent(MODE_EVT, { detail: m }));
}
/** Re-renders when the visitor signs in or out. */
export function useAccountMode() {
  const [m, setM] = useState<Mode>(mode);
  useEffect(() => {
    const on = (e: Event) => setM((e as CustomEvent<Mode>).detail);
    setM(mode);
    window.addEventListener(MODE_EVT, on);
    return () => window.removeEventListener(MODE_EVT, on);
  }, []);
  return m;
}

/** Saves and tells every open component. Returns false if the device refused (private mode or storage full). */
export function save<T>(key: string, value: T, opts?: { silent?: boolean }): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
    if (mode === "member" && !opts?.silent) queuePush(key);
    return true;
  } catch {
    return false;
  }
}

/* ───────── Sending changes to the account ───────── */

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let syncedDiary = new Set<string>();

function queuePush(key: string) {
  if (key !== KEYS.diary && key !== KEYS.routine && key !== KEYS.event && key !== KEYS.plan) return;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => void push(key), 700));
}

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin" });

const numbersOnly = (e: DiaryEntry) => ({ id: e.id, at: e.at, score: e.score, bpm: e.bpm, metrics: e.metrics });

async function push(key: string) {
  try {
    if (key === KEYS.diary) {
      const list = load<DiaryEntry[]>(KEYS.diary, []);
      const now = new Set(list.map((e) => e.id));
      for (const e of list) if (!syncedDiary.has(e.id)) if ((await send("/api/me/scans", "POST", numbersOnly(e))).ok) syncedDiary.add(e.id);
      for (const id of [...syncedDiary]) if (!now.has(id)) if ((await send("/api/me/scans", "DELETE", { id })).ok) syncedDiary.delete(id);
      return;
    }
    const kind = key === KEYS.routine ? "routine" : key === KEYS.event ? "event" : "plan";
    await send("/api/me/glow", "PUT", { kind, value: load(key, kind === "routine" ? [] : {}) });
  } catch {
    /* offline: the next change sends it again */
  }
}

type ServerState = { diary: DiaryEntry[]; routine: unknown; event: unknown; plan: unknown; club: Club };

/** Replaces this phone's copy with the account's, keeping any photos that live only on this phone. */
export async function pullFromAccount(): Promise<boolean> {
  const res = await fetch("/api/me/glow", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return false;
  const st = (await res.json()) as ServerState;
  const photos = new Map(load<DiaryEntry[]>(KEYS.diary, []).filter((e) => e.photo).map((e) => [e.id, e.photo]));
  const diary = st.diary.map((e) => ({ ...e, photo: photos.get(e.id) }));
  syncedDiary = new Set(diary.map((e) => e.id));
  save(KEYS.diary, diary, { silent: true });
  if (st.routine) save(KEYS.routine, st.routine, { silent: true });
  if (st.event) save(KEYS.event, st.event, { silent: true });
  if (st.plan) save(KEYS.plan, st.plan, { silent: true });
  save(KEYS.club, st.club, { silent: true });
  return true;
}

/**
 * Called once when a member is known to be signed in on this phone:
 * 1. First time for this account on this phone: copy what the phone already had into the account (server does it once).
 * 2. Save a scan that was waiting for sign-up.
 * 3. Load the account's copy.
 */
export async function connectAccount(accountKey: string) {
  setAccountMode("member");
  try {
    if (window.localStorage.getItem(SYNCED_FOR) !== accountKey) {
      const club = load<Partial<Club>>(KEYS.club, {});
      const pts = Math.max(0, (club.ledger ?? []).reduce((s, e) => s + (e.pts > 0 ? e.pts : 0), 0) - (club.redeemed ?? []).reduce((s, r) => s + r.pts, 0));
      const payload = {
        diary: load<DiaryEntry[]>(KEYS.diary, []).slice(-150).map(numbersOnly),
        routine: load<unknown[] | null>(KEYS.routine, null) ?? undefined,
        event: load<Record<string, unknown> | null>(KEYS.event, null) ?? undefined,
        plan: load<Record<string, unknown> | null>(KEYS.plan, null) ?? undefined,
        points: pts,
      };
      const res = await send("/api/me/import", "POST", payload);
      if (res.ok) window.localStorage.setItem(SYNCED_FOR, accountKey);
    }
    const pending = window.sessionStorage.getItem(PENDING_SCAN);
    if (pending) {
      window.sessionStorage.removeItem(PENDING_SCAN);
      const e = JSON.parse(pending) as Omit<DiaryEntry, "id" | "at">;
      const entry = { ...e, id: uid(), at: new Date().toISOString() };
      await send("/api/me/scans", "POST", numbersOnly(entry));
      const list = load<DiaryEntry[]>(KEYS.diary, []);
      save(KEYS.diary, trimDiary([...list, entry]), { silent: true });
    }
  } catch {
    /* keep going: the pull below still loads the account */
  }
  await pullFromAccount();
}

/** Signing out: clear this phone's copy so the next person on a shared phone can't see it. */
export function forgetDevice() {
  setAccountMode("guest");
  try {
    for (const k of [KEYS.diary, KEYS.routine, KEYS.event, KEYS.plan, KEYS.club, SYNCED_FOR]) window.localStorage.removeItem(k);
    window.sessionStorage.removeItem(PENDING_SCAN);
    for (const k of [KEYS.diary, KEYS.routine, KEYS.event, KEYS.plan, KEYS.club]) window.dispatchEvent(new CustomEvent(EVT, { detail: k }));
  } catch {
    /* nothing to clear */
  }
}

/** A scan from a visitor without an account waits here (this tab only) until they sign up. */
export function holdScanForSignup(entry: Omit<DiaryEntry, "id" | "at">) {
  try {
    window.sessionStorage.setItem(PENDING_SCAN, JSON.stringify({ ...entry, photo: undefined }));
  } catch {
    /* private mode */
  }
}

/** React state that lives in localStorage and stays in sync across components and tabs. `ready` is false until it has loaded. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => setValue(load(key, fallback));
    read();
    setReady(true);
    const onLocal = (e: Event) => (e as CustomEvent).detail === key && read();
    const onTab = (e: StorageEvent) => e.key === key && read();
    window.addEventListener(EVT, onLocal);
    window.addEventListener("storage", onTab);
    return () => {
      window.removeEventListener(EVT, onLocal);
      window.removeEventListener("storage", onTab);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(load(key, fallback)) : next;
      setValue(v);
      return save(key, v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set, ready] as const;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/** Local calendar day, e.g. 2026-11-13 (not UTC, so "today" matches the visitor's clock). */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ───────── Skin Diary ───────── */

export type DiaryMetric = { key: string; label: string; value: string; level: number };
export type DiaryEntry = { id: string; at: string; score: number; bpm?: number; metrics: DiaryMetric[]; photo?: string };
const MAX_ENTRIES = 120;
const MAX_PHOTOS = 16;

/** Keeps the newest entries, and photos only on the first entry and the most recent ones (so "before and after" always works). */
export function trimDiary(list: DiaryEntry[], maxPhotos = MAX_PHOTOS): DiaryEntry[] {
  const kept = list.slice(-MAX_ENTRIES);
  const withPhoto = kept.filter((e) => e.photo);
  if (withPhoto.length <= maxPhotos) return kept;
  const keep = new Set([withPhoto[0].id, ...withPhoto.slice(-(maxPhotos - 1)).map((e) => e.id)]);
  return kept.map((e) => (e.photo && !keep.has(e.id) ? { ...e, photo: undefined } : e));
}

/** Adds a scan to the diary. If the device is out of space it keeps fewer photos rather than losing the numbers. */
export function addDiaryEntry(entry: Omit<DiaryEntry, "id" | "at">): DiaryEntry | null {
  if (mode !== "member") {
    holdScanForSignup(entry);
    return null;
  }
  const e: DiaryEntry = { ...entry, id: uid(), at: new Date().toISOString() };
  const list = [...load<DiaryEntry[]>(KEYS.diary, []), e];
  for (const photos of [MAX_PHOTOS, 6, 2, 0]) if (save(KEYS.diary, trimDiary(list, photos))) return e;
  return null;
}

/** A small JPEG for the diary (about 15 KB), cropped from the scan photo. */
export function thumbnail(dataUrl: string, size = 320): Promise<string | undefined> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const k = size / Math.max(im.naturalWidth, im.naturalHeight);
        const c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * k);
        c.height = Math.round(im.naturalHeight * k);
        c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(undefined);
      }
    };
    im.onerror = () => resolve(undefined);
    im.src = dataUrl;
  });
}

/* ───────── Glow Club ───────── */

export type ClubEvent = { id: string; at: string; kind: EarnKey; pts: number; label: string; code?: string };
export type ClubRedeem = { id: string; at: string; reward: string; name: string; pts: number; code: string };
export type Club = { me: string; ledger: ClubEvent[]; redeemed: ClubRedeem[] };
export const EMPTY_CLUB: Club = { me: "", ledger: [], redeemed: [] };

const friendly = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike letters
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
};

export function getClub(): Club {
  const c = { ...EMPTY_CLUB, ...load<Partial<Club>>(KEYS.club, {}) } as Club;
  if (!c.me) {
    c.me = friendly();
    save(KEYS.club, c);
  }
  return c;
}

export const lifetime = (c: Club) => c.ledger.reduce((s, e) => s + e.pts, 0);
export const balance = (c: Club) => lifetime(c) - c.redeemed.reduce((s, r) => s + r.pts, 0);

/** Has this action already been counted (today, or ever, depending on its rule)? */
export function earned(c: Club, kind: EarnKey, code?: string) {
  const rule = EARN[kind];
  const today = dayKey();
  return c.ledger.some((e) => e.kind === kind && (rule.limit === "once" || (rule.limit === "day" && dayKey(new Date(e.at)) === today) || (rule.limit === "code" && e.code === code && dayKey(new Date(e.at)) === today)));
}

/** Gives points for an action, respecting its limit. Returns the points given (0 if already counted). */
export function award(kind: EarnKey, opts?: { pts?: number; label?: string; code?: string }): number {
  if (mode !== "member") return 0; // points need a free account
  if (kind !== "scan" && kind !== "code") {
    // the server decides; the phone shows the points straight away and the next pull corrects any difference
    void send("/api/me/points", "POST", { kind }).then(() => pullFromAccount()).catch(() => {});
  }
  const c = getClub();
  if (earned(c, kind, opts?.code)) return 0;
  const pts = opts?.pts ?? EARN[kind].pts;
  if (pts <= 0) return 0;
  c.ledger.push({ id: uid(), at: new Date().toISOString(), kind, pts, label: opts?.label ?? EARN[kind].label, code: opts?.code });
  c.ledger = c.ledger.slice(-400);
  return save(KEYS.club, c) ? pts : 0;
}

/** Clinic code for points, checked and given by the server. */
export async function awardCode(code: string): Promise<{ pts: number; error?: string }> {
  if (mode !== "member") return { pts: 0, error: "Sign in to collect points." };
  const res = await send("/api/me/points", "POST", { kind: "code", code });
  const d = (await res.json().catch(() => ({}))) as { pts?: number; error?: string };
  if (!res.ok) return { pts: 0, error: d.error ?? "That code didn't work." };
  await pullFromAccount();
  return { pts: d.pts ?? 0, error: d.pts ? undefined : "You already used this code today." };
}

/** Spends points on a reward (server checks the balance and makes the code). */
export async function redeemReward(reward: { id: string }): Promise<ClubRedeem | null> {
  if (mode !== "member") return null;
  const res = await send("/api/me/redeem", "POST", { reward: reward.id });
  if (!res.ok) return null;
  const d = (await res.json()) as { redeemed: ClubRedeem };
  await pullFromAccount();
  return d.redeemed;
}

/** Spends points on a reward. Returns the code to show the front desk, or null if there aren't enough points. */
export function redeem(reward: { id: string; name: string; pts: number }): ClubRedeem | null {
  const c = getClub();
  if (balance(c) < reward.pts) return null;
  const r: ClubRedeem = { id: uid(), at: new Date().toISOString(), reward: reward.id, name: reward.name, pts: reward.pts, code: `${c.me}-${friendly().slice(0, 4)}` };
  c.redeemed.push(r);
  return save(KEYS.club, c) ? r : null;
}
