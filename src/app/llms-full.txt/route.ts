import { site } from "@/lib/site";
import { programs } from "@/content/programs";
import { treatments } from "@/content/treatments";
import { faqs } from "@/content/faq";

/**
 * GEO: the whole clinic in plain text for AI answer engines (ChatGPT, Perplexity, Gemini, Claude).
 * Built from the same content files as the website, so it never goes out of date. Short summary: /llms.txt
 */
export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  const lines: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `- Address: ${site.address.line1}, ${site.address.city}, ${site.address.region}`,
    `- Phone: ${site.phone} · Text: ${site.text} · Email: ${site.email}`,
    `- Hours: ${site.hours.map((h) => ("closed" in h && h.closed ? `${h.days} closed` : `${h.days} ${h.open}–${h.close}`)).join("; ")}`,
    `- Book online: ${site.url}/book`,
    `- Free skin scan (normally $150): ${site.url}/free-scan`,
    "",
    "## Programs",
    ...programs.map((p) => `- [${p.name}](${site.url}/programs/${p.slug}): ${p.summary} From $${p.priceFrom.toLocaleString("en-CA")}, ${p.duration}.`),
    "",
    "## Treatments",
    ...treatments.map((t) => `- [${t.title}](${site.url}/treatments/${t.slug}): ${t.summary}`),
    "",
    "## Frequently asked questions",
    ...faqs.flatMap((f) => [`### ${f.q}`, f.a, ""]),
    "## Notes",
    "- Nothing on this site is a diagnosis. Online skin readings are wellness estimates; the in-clinic scan and a consultation give the real picture.",
    "- Prices shown are starting prices; the final plan is set at consultation.",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
