/**
 * Routine Builder: reads a product's ingredient list, works out what it does, and puts the products
 * a person owns into a safe morning and night order. Plain rules from standard skincare practice; no AI.
 * It gives guidance, not medical advice.
 */
export type ProductType = "cleanser" | "toner" | "serum" | "exfoliant" | "retinoid" | "treatment" | "eye" | "moisturizer" | "oil" | "spf" | "mask" | "other";
export type Active = "retinoid" | "aha" | "bha" | "pha" | "vitc" | "niacinamide" | "bpo" | "azelaic" | "ha" | "ceramide" | "peptide" | "spf";
export type Flag = "fragrance" | "alcohol";

export type Product = { id: string; name: string; brand?: string; type: ProductType; actives: Active[]; flags: Flag[]; image?: string; barcode?: string; known: boolean };

export const TYPE_LABEL: Record<ProductType, string> = {
  cleanser: "Cleanser",
  toner: "Toner or essence",
  serum: "Serum",
  exfoliant: "Exfoliating acid",
  retinoid: "Retinol",
  treatment: "Spot treatment",
  eye: "Eye cream",
  moisturizer: "Moisturiser",
  oil: "Face oil",
  spf: "Sunscreen (SPF)",
  mask: "Mask",
  other: "Other",
};

export const ACTIVE_LABEL: Record<Active, string> = {
  retinoid: "Retinol",
  aha: "AHA acid",
  bha: "BHA (salicylic acid)",
  pha: "PHA acid",
  vitc: "Vitamin C",
  niacinamide: "Niacinamide",
  bpo: "Benzoyl peroxide",
  azelaic: "Azelaic acid",
  ha: "Hyaluronic acid",
  ceramide: "Ceramides",
  peptide: "Peptides",
  spf: "Sun filters",
};

/** Products people can add by hand when a barcode isn't found. */
export const QUICK: { type: ProductType; name: string; actives: Active[] }[] = [
  { type: "cleanser", name: "Cleanser", actives: [] },
  { type: "moisturizer", name: "Moisturiser", actives: [] },
  { type: "spf", name: "Sunscreen (SPF)", actives: ["spf"] },
  { type: "serum", name: "Vitamin C serum", actives: ["vitc"] },
  { type: "retinoid", name: "Retinol", actives: ["retinoid"] },
  { type: "exfoliant", name: "Exfoliating acid (AHA or BHA)", actives: ["aha"] },
  { type: "serum", name: "Niacinamide serum", actives: ["niacinamide"] },
  { type: "serum", name: "Hyaluronic acid serum", actives: ["ha"] },
  { type: "treatment", name: "Benzoyl peroxide", actives: ["bpo"] },
  { type: "eye", name: "Eye cream", actives: [] },
  { type: "toner", name: "Toner", actives: [] },
  { type: "oil", name: "Face oil", actives: [] },
];

const ACTIVE_RX: [Active, RegExp][] = [
  ["retinoid", /\b(retinol|retinal\b|retinaldehyde|retinyl (palmitate|acetate|propionate|retinoate)|hydroxypinacolone retinoate|adapalene|tretinoin|granactive)/],
  ["aha", /\b(glycolic acid|lactic acid|mandelic acid|tartaric acid|malic acid)/],
  ["bha", /\b(salicylic acid|betaine salicylate|capryloyl salicylic acid)/],
  ["pha", /\b(gluconolactone|lactobionic acid)/],
  ["vitc", /\b(ascorbic acid|ascorbyl|ethyl ascorbic|sodium ascorbyl phosphate|magnesium ascorbyl phosphate|tetrahexyldecyl ascorbate)/],
  ["niacinamide", /\bniacinamide\b/],
  ["bpo", /\bbenzoyl peroxide\b/],
  ["azelaic", /\b(azelaic acid|potassium azeloyl)/],
  ["ha", /\b(hyaluron|sodium hyaluronate)/],
  ["ceramide", /\bceramide/],
  ["peptide", /peptide\b/],
];
// filters that only appear in sunscreens (zinc oxide and titanium dioxide are also in makeup, so they need "SPF" in the name)
const SUN_FILTER = /\b(avobenzone|butyl methoxydibenzoylmethane|octocrylene|homosalate|octinoxate|ethylhexyl methoxycinnamate|octisalate|ethylhexyl salicylate|oxybenzone|benzophenone-3|bemotrizinol|bis-ethylhexyloxyphenol|tinosorb|ethylhexyl triazone|drometrizole|ecamsule|uvinul)/;
const SPF_NAME = /\b(spf|sunscreen|sun ?screen|sunblock|sun cream|solaire|ecran|écran|uv ?(protect|defen[cs]e|shield))/;

const TYPE_RX: [ProductType, RegExp][] = [
  ["cleanser", /\b(cleans|face wash|facial wash|wash\b|micellar|nettoyant|makeup remover|cleansing)/],
  ["eye", /\b(eye|yeux|contour des)/],
  ["mask", /\b(mask|masque)\b/],
  ["oil", /\b(face oil|facial oil|huile|rosehip oil|squalane oil)\b/],
  ["toner", /\b(toner|tonic|tonique|essence|mist)\b/],
  ["serum", /\b(serum|sérum|ampoule|booster|concentrate)\b/],
  ["treatment", /\b(spot|blemish treatment|acne treatment)\b/],
  ["moisturizer", /\b(moistur|cream|creme|crème|lotion|hydrat|gel-cream|balm|baume|emulsion)/],
];

/** Works out actives, flags and the product type from its name and (when known) its ingredient list. */
export function analyse(name: string, ingredients = "", categories = ""): Pick<Product, "type" | "actives" | "flags" | "known"> {
  const n = `${name} ${categories}`.toLowerCase();
  const ing = ingredients.toLowerCase();
  const text = `${n} ${ing}`;
  const actives = ACTIVE_RX.filter(([, rx]) => rx.test(text)).map(([a]) => a);
  // "vitamin c", "retinol" and friends in the name count even when the ingredient list is missing
  if (/\bvitamin c\b|\bvit\.? ?c\b/.test(n) && !actives.includes("vitc")) actives.push("vitc");
  if (/\b(aha|glycolic)\b/.test(n) && !actives.includes("aha")) actives.push("aha");
  if (/\b(bha|salicylic)\b/.test(n) && !actives.includes("bha")) actives.push("bha");
  const isSpf = SPF_NAME.test(n) || SUN_FILTER.test(ing);
  if (isSpf) actives.push("spf");

  const flags: Flag[] = [];
  if (/\b(parfum|fragrance|aroma)\b/.test(ing)) flags.push("fragrance");
  // drying alcohol only matters near the top of the list
  const top = ing.split(/[,;•]/).slice(0, 6).join(",");
  if (/\b(alcohol denat|sd alcohol|denatured alcohol|ethanol)\b/.test(top) || /^\s*alcohol\b|,\s*alcohol\s*(,|$)/.test(top)) flags.push("alcohol");

  let type: ProductType = "other";
  const named = TYPE_RX.find(([, rx]) => rx.test(n))?.[0];
  if (isSpf && named !== "cleanser") type = "spf";
  else if (named === "cleanser" || named === "eye" || named === "mask") type = named;
  else if (actives.includes("retinoid")) type = "retinoid";
  else if (actives.includes("bpo")) type = "treatment";
  else if ((actives.includes("aha") || actives.includes("bha") || actives.includes("pha")) && named !== "moisturizer") type = "exfoliant";
  else if (named) type = named;
  else if (actives.some((a) => ["vitc", "niacinamide", "ha", "peptide", "azelaic"].includes(a))) type = "serum";
  return { type, actives, flags, known: Boolean(ingredients.trim()) || type !== "other" };
}

export type Step = { product: Product; note?: string };
export type Advice = { tone: "stop" | "care" | "info"; title: string; text: string; ids: string[] };
export type Missing = { key: "spf" | "moisturizer" | "cleanser"; title: string; text: string };
export type Routine = { am: Step[]; pm: Step[]; advice: Advice[]; missing: Missing[]; score: number; verdict: Record<string, "keep" | "care"> };

const AM_ORDER: ProductType[] = ["cleanser", "toner", "serum", "treatment", "eye", "moisturizer", "spf"];
const PM_ORDER: ProductType[] = ["cleanser", "toner", "exfoliant", "retinoid", "serum", "treatment", "eye", "moisturizer", "oil", "mask"];

const has = (p: Product, ...a: Active[]) => a.some((x) => p.actives.includes(x));
const isAcid = (p: Product) => p.type !== "cleanser" && has(p, "aha", "bha", "pha");
const isRetinoid = (p: Product) => p.type !== "cleanser" && has(p, "retinoid");

/** Puts the products in a morning and night order and lists what to watch, what clashes and what is missing. */
export function buildRoutine(products: Product[]): Routine {
  const advice: Advice[] = [];
  const retinoids = products.filter(isRetinoid);
  const acids = products.filter(isAcid);
  const bpos = products.filter((p) => has(p, "bpo") && p.type !== "cleanser");
  const spf = products.filter((p) => p.type === "spf" || has(p, "spf"));
  const strong = retinoids.length + acids.length > 0;

  // morning: no retinol, no leave-on acids; vitamin C belongs here
  const am = products
    .filter((p) => {
      if (isRetinoid(p) || p.type === "oil" || p.type === "mask") return false;
      if (isAcid(p) && p.type === "exfoliant") return false;
      if (has(p, "bpo") && retinoids.length === 0 && p.type !== "cleanser") return false; // one BPO slot is enough: at night when there's no retinol
      return true;
    })
    .map<Step>((p) => ({ product: p, note: p.type === "spf" ? "Last step. Two fingers of product." : has(p, "vitc") ? "Vitamin C works best in the morning, under SPF." : has(p, "bpo") && retinoids.length ? "Morning, so it stays away from your retinol." : undefined }));
  const pm = products
    .filter((p) => {
      if (p.type === "spf") return false;
      if (has(p, "vitc") && p.type === "serum" && !has(p, "retinoid", "aha", "bha")) return false; // keep vitamin C for the morning
      if (has(p, "bpo") && retinoids.length > 0 && p.type !== "cleanser") return false;
      return true;
    })
    .map<Step>((p) => ({
      product: p,
      note: isRetinoid(p) ? (acids.length ? "Retinol nights only. Start 2 nights a week." : "Start 2 nights a week, then build up.") : isAcid(p) && p.type === "exfoliant" ? (retinoids.length ? "Acid nights only. Never the same night as retinol." : "2 or 3 nights a week is enough.") : p.type === "mask" ? "Once a week." : undefined,
    }));
  const rank = (order: ProductType[]) => (a: Step, b: Step) => (order.indexOf(a.product.type) + 1 || 99) - (order.indexOf(b.product.type) + 1 || 99);
  am.sort(rank(AM_ORDER));
  pm.sort(rank(PM_ORDER));

  if (retinoids.length && acids.length) advice.push({ tone: "stop", title: "Don't use retinol and acids on the same night", text: "Together they can burn and peel. Use them on different nights, with a plain night in between.", ids: [...retinoids, ...acids].map((p) => p.id) });
  if (retinoids.length && bpos.length) advice.push({ tone: "stop", title: "Keep benzoyl peroxide away from retinol", text: "Benzoyl peroxide can weaken retinol and both dry the skin. Use benzoyl peroxide in the morning and retinol at night.", ids: [...retinoids, ...bpos].map((p) => p.id) });
  if (retinoids.length > 1) advice.push({ tone: "care", title: "Two retinol products is too much", text: "Pick one. Using both adds redness, not results.", ids: retinoids.map((p) => p.id) });
  if (acids.length > 1) advice.push({ tone: "care", title: "More than one exfoliating acid", text: "Pick one and use it 2 or 3 nights a week. Too much acid makes skin sore and shiny.", ids: acids.map((p) => p.id) });
  if (strong && !spf.length) advice.push({ tone: "stop", title: "You need sunscreen with these products", text: "Retinol and acids make skin burn faster in the sun. Wear SPF 30 or more every morning.", ids: [...retinoids, ...acids].map((p) => p.id) });
  const vitc = products.filter((p) => has(p, "vitc"));
  if (vitc.length && acids.length) advice.push({ tone: "info", title: "Vitamin C in the morning, acids at night", text: "They work better apart, and your skin stays calmer.", ids: [...vitc, ...acids].map((p) => p.id) });
  const drying = products.filter((p) => p.flags.includes("alcohol") && p.type !== "spf");
  if (drying.length) advice.push({ tone: "care", title: "High in drying alcohol", text: "Fine for oily skin. If your skin feels tight or dry, swap it for an alcohol-free one.", ids: drying.map((p) => p.id) });
  const scented = products.filter((p) => p.flags.includes("fragrance") && p.type !== "cleanser");
  if (scented.length) advice.push({ tone: "info", title: "Has fragrance", text: "Fine for most people. If your skin is red, stings or reacts easily, choose fragrance-free.", ids: scented.map((p) => p.id) });

  const missing: Missing[] = [];
  if (!spf.length) missing.push({ key: "spf", title: "Sunscreen (SPF 30+)", text: "The one product that protects everything else you do. Every morning, all year." });
  if (!products.some((p) => p.type === "moisturizer")) missing.push({ key: "moisturizer", title: "A moisturiser", text: "It keeps water in your skin and calms it, which matters a lot in Calgary's dry air." });
  if (!products.some((p) => p.type === "cleanser")) missing.push({ key: "cleanser", title: "A gentle cleanser", text: "Wash at night to take off SPF, makeup and the day." });

  const verdict: Record<string, "keep" | "care"> = {};
  for (const p of products) verdict[p.id] = advice.some((a) => a.tone !== "info" && a.ids.includes(p.id)) ? "care" : "keep";

  let score = 100;
  for (const m of missing) score -= m.key === "spf" ? 30 : m.key === "moisturizer" ? 15 : 10;
  for (const a of advice) score -= a.tone === "stop" ? (a.title.startsWith("You need sunscreen") ? 0 : 15) : a.tone === "care" ? 8 : 0;
  return { am, pm, advice, missing, score: products.length ? Math.max(5, Math.min(100, score)) : 0, verdict };
}
