/**
 * Event Countdown: turns a date (wedding, vacation, birthday…) into a week-by-week skin plan.
 * Every step has an ideal time and a last safe time before the day; anything too close is skipped, not squeezed in.
 */
export type EventType = "wedding" | "vacation" | "party" | "photos" | "other";
export type Goal = "glow" | "breakouts" | "spots" | "lines" | "shape" | "hair";

export const EVENT_LABEL: Record<EventType, string> = { wedding: "Wedding", vacation: "Vacation", party: "Birthday or party", photos: "Photos or graduation", other: "Something else" };
export const EVENT_NOUN: Record<EventType, string> = { wedding: "your wedding", vacation: "your trip", party: "your party", photos: "your photos", other: "your big day" };
export const GOAL_LABEL: Record<Goal, string> = { glow: "Glow", breakouts: "Clear breakouts", spots: "Fade dark spots", lines: "Soften lines", shape: "Lips and shape", hair: "Smooth skin (hair removal)" };

type Rule = {
  id: string;
  goals: Goal[] | "all";
  idealWeeks: number; // best time to do it, in weeks before the day
  latestWeeks: number; // last safe time; closer than this, skip it
  title: string;
  detail: string;
  book?: { key: string; label: string };
  href?: string;
};

const RULES: Rule[] = [
  { id: "scan", goals: "all", idealWeeks: 52, latestWeeks: 1, title: "Free skin scan", detail: "See what your skin needs before you spend anything. It takes 15 seconds.", book: { key: "skin-scan", label: "Free skin scan" } },
  { id: "hair", goals: ["hair"], idealWeeks: 26, latestWeeks: 8, title: "Start laser hair removal", detail: "Hair grows in cycles, so you need 6 to 8 sessions, 4 to 6 weeks apart. Start as early as you can.", book: { key: "laser-hair-removal", label: "Laser hair removal" } },
  { id: "acne", goals: ["breakouts"], idealWeeks: 16, latestWeeks: 6, title: "Start your Clear Skin plan", detail: "Breakouts calm down over 8 to 12 weeks. We find the cause first, then treat.", book: { key: "clear-skin", label: "Clear Skin Program" } },
  { id: "spots", goals: ["spots"], idealWeeks: 16, latestWeeks: 6, title: "Start fading dark spots", detail: "Peels and gentle laser work in a series, about a month apart. Dark spots fade slowly, so start early.", book: { key: "even-tone", label: "Even Tone Program" } },
  { id: "laser", goals: ["lines", "glow"], idealWeeks: 12, latestWeeks: 6, title: "Laser for texture and firmness", detail: "A Fotona session builds new collagen. Skin keeps getting better for weeks after.", book: { key: "fotona-laser", label: "Fotona laser" } },
  { id: "routine", goals: "all", idealWeeks: 10, latestWeeks: 4, title: "Lock in your home routine", detail: "Start any new product now. Skin needs about 4 weeks to settle, and you want no surprises near the day.", href: "/routine" },
  { id: "filler", goals: ["shape"], idealWeeks: 6, latestWeeks: 4, title: "Filler", detail: "Swelling and small bruises need time to go. This also leaves room for a small tweak.", book: { key: "dermal-fillers", label: "Filler" } },
  { id: "relaxer", goals: ["lines"], idealWeeks: 4, latestWeeks: 3, title: "Wrinkle relaxer", detail: "It takes 2 weeks to work fully. Doing it now means it looks its best on the day.", book: { key: "neuromodulators", label: "Wrinkle relaxer" } },
  { id: "peel", goals: ["glow", "spots", "breakouts"], idealWeeks: 4, latestWeeks: 2, title: "Last peel", detail: "Your last stronger treatment. Any flaking is gone well before the day.", book: { key: "alumier-peel", label: "Chemical peel" } },
  { id: "facial", goals: "all", idealWeeks: 1, latestWeeks: 0.3, title: "Glow facial", detail: "A gentle, hydrating facial 3 to 7 days before. No extractions, nothing new.", book: { key: "facials", label: "Facial" } },
];

export type PlanStep = { id: string; title: string; detail: string; date: Date; state: "now" | "soon" | "later"; when: string; book?: { key: string; label: string }; href?: string };
export type Plan = { daysLeft: number; weeksLeft: number; steps: PlanStep[]; skipped: { id: string; title: string; why: string }[]; rules: string[] };

const DAY = 86400000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Reads a yyyy-mm-dd date as a local day (not UTC, which would shift it by a day in Calgary). */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export function buildPlan(event: Date, goals: Goal[], today = new Date()): Plan {
  const t0 = midnight(today);
  const e0 = midnight(event);
  const daysLeft = Math.round((e0.getTime() - t0.getTime()) / DAY);
  const weeksLeft = daysLeft / 7;
  const steps: PlanStep[] = [];
  const skipped: Plan["skipped"] = [];

  for (const r of RULES) {
    if (r.goals !== "all" && !r.goals.some((g) => goals.includes(g))) continue;
    if (weeksLeft < r.latestWeeks) {
      skipped.push({ id: r.id, title: r.title, why: r.latestWeeks >= 1 ? `Needs at least ${r.latestWeeks} week${r.latestWeeks === 1 ? "" : "s"} before the day.` : "Too close to the day." });
      continue;
    }
    // do it at its ideal time, or today if that has already passed
    const idealDate = new Date(e0.getTime() - Math.round(r.idealWeeks * 7) * DAY);
    const date = idealDate.getTime() <= t0.getTime() ? t0 : idealDate;
    const inDays = Math.round((date.getTime() - t0.getTime()) / DAY);
    const state: PlanStep["state"] = inDays <= 0 ? "now" : inDays <= 14 ? "soon" : "later";
    const weeksBefore = Math.round((e0.getTime() - date.getTime()) / DAY / 7);
    const daysBefore = Math.round((e0.getTime() - date.getTime()) / DAY);
    const when = inDays <= 0 ? "Do this now" : daysBefore < 14 ? `${daysBefore} day${daysBefore === 1 ? "" : "s"} before` : `${weeksBefore} weeks before`;
    steps.push({ id: r.id, title: r.title, detail: r.detail, date, state, when, book: r.book, href: r.href });
  }
  steps.sort((a, b) => a.date.getTime() - b.date.getTime());

  const rules: string[] = [];
  if (daysLeft <= 14) rules.push("Nothing new now. No new products, no new treatments, no picking.");
  else rules.push("In the last 2 weeks: nothing new. No new products or treatments.");
  rules.push("Wear SPF 30 or more every day. A tan or a burn undoes the work.");
  rules.push("The night before: sleep 8 hours, drink water and skip alcohol and salty food.");
  return { daysLeft, weeksLeft, steps, skipped, rules };
}
