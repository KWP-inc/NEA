import wpLocal from "@/content/generated/wp-local.json";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Full URL for an image hosted in NEA's existing WordPress media library. */
const WP = "https://neaprecisionskin.com/wp-content/uploads/";
const localWp = new Set<string>(wpLocal as string[]);

/**
 * NEA's own photos from the old WordPress site. After `npm run media:migrate` has copied a file into
 * public/media/wp/, it's served from this site; until then it still loads from WordPress.
 * Run the migration (and commit public/media/wp) BEFORE the domain moves off WordPress.
 */
export function nea(path: string) {
  const rel = path.startsWith(WP) ? path.slice(WP.length) : path.startsWith("http") ? null : path;
  if (rel === null) return path;
  return localWp.has(rel) ? `/media/wp/${rel}` : `${WP}${rel}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export function money(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}
