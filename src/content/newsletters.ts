/**
 * NEA's monthly newsletters (newest first).
 * To add one: put the PDF in public/newsletters/ (for example 2026-11.pdf) and fill in `file`.
 * A cover image is optional (public/newsletters/2026-11.jpg). Issues without a file stay hidden.
 */
export type Newsletter = { slug: string; month: string; title: string; summary: string; file: string; cover?: string };

export const newsletters: Newsletter[] = [
  { slug: "2026-11", month: "November 2026", title: "November newsletter", summary: "News, offers and skin tips from the clinic for November.", file: "" },
  { slug: "2026-10", month: "October 2026", title: "October newsletter", summary: "Fall skin reset: The Perfect Peel and microneedling offers, plus tips for fall skin.", file: "" },
];

export const publishedNewsletters = () => newsletters.filter((n) => n.file);
