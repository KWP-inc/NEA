/**
 * Glow Club: points for looking after your skin, traded for small rewards at the clinic.
 * Points live on the visitor's own phone (no account), so every reward is confirmed by the front desk when it is used.
 *
 * REWARDS ARE PLACEHOLDERS. Confirm each reward and its points with NEA before launch.
 */
export type EarnKey = "scan" | "routine" | "event" | "planner" | "share" | "code";

export const EARN: Record<EarnKey, { pts: number; label: string; how: string; limit: "day" | "once" | "code"; href?: string }> = {
  scan: { pts: 10, label: "Live face scan", how: "Scan your face. Once a day.", limit: "day", href: "/skin-diary" },
  routine: { pts: 20, label: "Routine check", how: "Check your products in the Routine Builder.", limit: "once", href: "/routine" },
  event: { pts: 20, label: "Event plan", how: "Make a countdown plan for your big day.", limit: "once", href: "/countdown" },
  planner: { pts: 10, label: "Injectables plan", how: "Build a plan in the Injectables Planner.", limit: "once", href: "/injectables" },
  share: { pts: 10, label: "Invite a friend", how: "Share your free-scan link with a friend.", limit: "once" },
  code: { pts: 0, label: "Clinic code", how: "Visit NEA and ask the front desk for a code.", limit: "code" },
};

export const TIERS = [
  { name: "Pearl", from: 0, perk: "You're in. Start earning." },
  { name: "Blush", from: 150, perk: "Early access to seasonal offers." },
  { name: "Gold", from: 400, perk: "Priority booking and a birthday treat." },
] as const;

/** PLACEHOLDERS: confirm with NEA. `book` is the booking key the reward opens. */
export const REWARDS = [
  { id: "samples", pts: 100, name: "Skincare sample kit", detail: "Three medical-grade samples picked for your skin.", book: "skin-scan" },
  { id: "addon", pts: 250, name: "Free facial add-on", detail: "Dermaplane or peel add-on with any facial.", book: "facials" },
  { id: "credit", pts: 500, name: "$50 off a treatment", detail: "On any treatment of $250 or more.", book: "popular" },
  { id: "facial", pts: 800, name: "A facial on us", detail: "A Brightening or Anti-Aging Facial.", book: "facials" },
] as const;

export const tierFor = (lifetime: number) => [...TIERS].reverse().find((t) => lifetime >= t.from) ?? TIERS[0];
export const nextTier = (lifetime: number) => TIERS.find((t) => t.from > lifetime);
