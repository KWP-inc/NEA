"use client";
/**
 * "My Glow" data: the Skin Diary, routine, event plan, injectables plan and Glow Club points.
 * Everything is saved on the visitor's own device (localStorage). Nothing is sent to NEA; there is no account.
 */
import { useCallback, useEffect, useState } from "react";
import { EARN, type EarnKey } from "@/content/club";

export const KEYS = { diary: "nea-diary-v1", routine: "nea-routine-v1", event: "nea-event-v1", plan: "nea-injectables-v1", club: "nea-club-v1", ref: "nea-ref" } as const;
const EVT = "nea:store";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Saves and tells every open component. Returns false if the device refused (private mode or storage full). */
export function save<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
    return true;
  } catch {
    return false;
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
  const c = getClub();
  if (earned(c, kind, opts?.code)) return 0;
  const pts = opts?.pts ?? EARN[kind].pts;
  if (pts <= 0) return 0;
  c.ledger.push({ id: uid(), at: new Date().toISOString(), kind, pts, label: opts?.label ?? EARN[kind].label, code: opts?.code });
  c.ledger = c.ledger.slice(-400);
  return save(KEYS.club, c) ? pts : 0;
}

/** Spends points on a reward. Returns the code to show the front desk, or null if there aren't enough points. */
export function redeem(reward: { id: string; name: string; pts: number }): ClubRedeem | null {
  const c = getClub();
  if (balance(c) < reward.pts) return null;
  const r: ClubRedeem = { id: uid(), at: new Date().toISOString(), reward: reward.id, name: reward.name, pts: reward.pts, code: `${c.me}-${friendly().slice(0, 4)}` };
  c.redeemed.push(r);
  return save(KEYS.club, c) ? r : null;
}
