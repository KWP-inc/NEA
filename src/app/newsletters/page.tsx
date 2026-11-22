import { Download, FileText, Instagram } from "lucide-react";
import { PageHero } from "@/components/sections/page-hero";
import { LeadForm } from "@/components/sections/lead-form";
import { publishedNewsletters } from "@/content/newsletters";
import { pageMeta } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = pageMeta({
  title: "NEA Newsletters",
  description: "Read NEA Precision Skin's monthly newsletters: clinic news, seasonal offers and simple skin tips from our team in Calgary.",
  path: "/newsletters",
});

export default function NewslettersPage() {
  const list = publishedNewsletters();
  return (
    <>
      <PageHero trail={[{ name: "Newsletters", path: "/newsletters" }]} title="Newsletters." lede="Clinic news, monthly offers and simple skin tips. Read them here or download the PDF." className="!pb-10 md:!pb-14" />
      <section className="container pb-16">
        {list.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((n) => (
              <article key={n.slug} className="surface flex flex-col overflow-hidden rounded-4xl">
                {n.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.cover} alt={`${n.month} newsletter cover`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/5] place-items-center bg-mist">
                    <FileText className="h-12 w-12 text-graphite" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-[13px] text-graphite">{n.month}</p>
                  <h2 className="mt-1 text-[1.35rem] font-semibold">{n.title}</h2>
                  <p className="mt-2 flex-1 text-[15px] text-graphite">{n.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a href={n.file} target="_blank" rel="noreferrer" className="btn-primary">
                      <FileText className="h-4 w-4" /> Read
                    </a>
                    <a href={n.file} download className="btn-ghost">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface rounded-4xl p-8 text-center">
            <p className="text-[1.2rem] font-semibold">New issues are on the way.</p>
            <p className="mx-auto mt-2 max-w-md text-graphite">Get the next one in your inbox, or follow us on Instagram for news between issues.</p>
            <a href={site.social.instagram} target="_blank" rel="noreferrer" className="btn-ghost mt-5 inline-flex">
              <Instagram className="h-4 w-4" /> @neaprecisionskin
            </a>
          </div>
        )}
      </section>
      <section className="chapter chapter-dark">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-display-md font-semibold">Get the next issue by email.</h2>
            <p className="measure mt-4 text-lede text-graphite">One email a month. Unsubscribe any time.</p>
          </div>
          <div className="glass-dark rounded-4xl p-6 md:p-10">
            <LeadForm kind="newsletter" source="newsletters-page" dark />
          </div>
        </div>
      </section>
    </>
  );
}
