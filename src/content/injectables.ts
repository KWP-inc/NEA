/**
 * Injectables Planner: the areas people ask about most, with typical amounts, how long results last,
 * recovery and when a top-up is usually due.
 *
 * Amounts are TYPICAL RANGES from common practice, for planning only. The injector sets the real dose at a consult.
 * Prices appear only where NEA publishes one in its booking system; everything else is "confirmed at your consult".
 * Wording stays generic ("wrinkle relaxer", "filler") to follow Canadian rules on advertising prescription products.
 */
export type InjectKind = "relaxer" | "filler" | "fat";
export type InjectArea = {
  id: string;
  name: string;
  kind: InjectKind;
  goal: string; // what it does, in plain words
  amount: string; // typical amount
  lasts: string; // how long it usually lasts
  topUpMonths: [number, number]; // when a top-up is usually due
  seen: string; // when you see the result
  recovery: string;
  latestBeforeEventWeeks: number; // do it at least this many weeks before a big day
  book: string; // booking key in content/jane.ts
  price?: { label: string; amount: number }; // only where NEA publishes it
  at: [number, number][]; // where the dots sit on the face drawing (300 × 400)
};

export const KIND_LABEL: Record<InjectKind, string> = { relaxer: "Wrinkle relaxer", filler: "Filler", fat: "Fat dissolver" };

export const INJECT_AREAS: InjectArea[] = [
  { id: "forehead", name: "Forehead lines", kind: "relaxer", goal: "Softens the lines across your forehead.", amount: "10 to 20 units", lasts: "3 to 4 months", topUpMonths: [3, 4], seen: "Starts in 3 to 5 days. Full result at 2 weeks.", recovery: "Back to your day right away. Tiny bumps fade in 20 minutes.", latestBeforeEventWeeks: 3, book: "neuromodulators", at: [[150, 82]] },
  { id: "frown", name: "Frown lines (the “11s”)", kind: "relaxer", goal: "Relaxes the lines between your brows.", amount: "15 to 25 units", lasts: "3 to 4 months", topUpMonths: [3, 4], seen: "Starts in 3 to 5 days. Full result at 2 weeks.", recovery: "Back to your day right away.", latestBeforeEventWeeks: 3, book: "neuromodulators", at: [[150, 124]] },
  { id: "crows", name: "Crow’s feet", kind: "relaxer", goal: "Softens the smile lines beside your eyes.", amount: "12 to 24 units (both sides)", lasts: "3 to 4 months", topUpMonths: [3, 4], seen: "Starts in 3 to 5 days. Full result at 2 weeks.", recovery: "Back to your day right away. A small bruise is possible.", latestBeforeEventWeeks: 3, book: "neuromodulators", at: [[66, 150], [234, 150]] },
  { id: "lipflip", name: "Lip flip", kind: "relaxer", goal: "Rolls the top lip out a little, so it shows more. No filler.", amount: "4 to 8 units", lasts: "2 to 3 months", topUpMonths: [2, 3], seen: "About 1 week.", recovery: "Back to your day right away.", latestBeforeEventWeeks: 3, book: "neuromodulators", at: [[150, 240]] },
  { id: "masseter", name: "Jaw slimming and teeth grinding", kind: "relaxer", goal: "Relaxes the chewing muscle. Softens a square jaw and eases clenching.", amount: "40 to 60 units (both sides)", lasts: "4 to 6 months", topUpMonths: [4, 6], seen: "Slimming shows in 4 to 6 weeks.", recovery: "Back to your day right away. Chewing can feel tired for a few days.", latestBeforeEventWeeks: 8, book: "neuromodulators", at: [[70, 236], [230, 236]] },
  { id: "chindimple", name: "Chin dimples", kind: "relaxer", goal: "Smooths an “orange peel” chin.", amount: "4 to 10 units", lasts: "3 to 4 months", topUpMonths: [3, 4], seen: "About 1 to 2 weeks.", recovery: "Back to your day right away.", latestBeforeEventWeeks: 3, book: "neuromodulators", at: [[150, 316]] },
  { id: "lips", name: "Lip filler", kind: "filler", goal: "Adds shape, softness or a little volume to your lips.", amount: "Half to 1 syringe", lasts: "6 to 12 months", topUpMonths: [6, 12], seen: "Right away. Settles in 2 weeks.", recovery: "Swelling for 2 to 5 days. A bruise is possible.", latestBeforeEventWeeks: 4, book: "dermal-fillers", price: { label: "Mini Lip Filler", amount: 350 }, at: [[150, 270]] },
  { id: "cheeks", name: "Cheek filler", kind: "filler", goal: "Lifts and shapes the cheeks. Can soften a tired look.", amount: "1 to 2 syringes", lasts: "12 to 18 months", topUpMonths: [12, 18], seen: "Right away. Settles in 2 weeks.", recovery: "Mild swelling for 2 to 3 days.", latestBeforeEventWeeks: 4, book: "dermal-fillers", at: [[86, 208], [214, 208]] },
  { id: "undereye", name: "Under-eye filler", kind: "filler", goal: "Softens hollows and shadows under the eyes.", amount: "Half to 1 syringe", lasts: "9 to 12 months", topUpMonths: [9, 12], seen: "Right away. Settles in 2 to 4 weeks.", recovery: "Swelling or a bruise can last up to a week.", latestBeforeEventWeeks: 6, book: "dermal-fillers", at: [[112, 178], [188, 178]] },
  { id: "smilelines", name: "Smile lines (nose to mouth)", kind: "filler", goal: "Softens the fold from your nose to the corner of your mouth.", amount: "1 to 2 syringes", lasts: "9 to 12 months", topUpMonths: [9, 12], seen: "Right away. Settles in 2 weeks.", recovery: "Mild swelling for 2 to 3 days.", latestBeforeEventWeeks: 4, book: "dermal-fillers", at: [[116, 232], [184, 232]] },
  { id: "jawline", name: "Jawline and chin filler", kind: "filler", goal: "Sharpens the jawline and balances the chin.", amount: "2 to 4 syringes", lasts: "12 to 18 months", topUpMonths: [12, 18], seen: "Right away. Settles in 2 weeks.", recovery: "Swelling and tenderness for 3 to 5 days.", latestBeforeEventWeeks: 4, book: "dermal-fillers", at: [[98, 296], [202, 296]] },
  { id: "underchin", name: "Under-chin fat", kind: "fat", goal: "Dissolves the small fat pad under the chin, for good.", amount: "2 to 4 sessions, about 6 weeks apart", lasts: "Long-lasting once the sessions are done", topUpMonths: [1.5, 1.5], seen: "After 2 sessions for most people.", recovery: "Swelling under the chin for 1 to 2 weeks after each session.", latestBeforeEventWeeks: 16, book: "belkyra", price: { label: "Per session", amount: 1100 }, at: [[150, 372]] },
];
