import Link from "next/link";
import { ArrowRight, Barcode, BookHeart, CalendarHeart, Crown, Syringe } from "lucide-react";
import { SkinWeather } from "@/components/glow/skin-weather";

const TOOLS = [
  { href: "/skin-diary", icon: BookHeart, name: "Skin Diary", text: "Scan your face each week. Watch your skin score change.", tag: "On your phone" },
  { href: "/routine", icon: Barcode, name: "Routine Builder", text: "Scan your products. See what clashes and what's missing.", tag: "Scan barcodes" },
  { href: "/countdown", icon: CalendarHeart, name: "Event Countdown", text: "A week-by-week plan to glow on your big day.", tag: "Weddings, trips" },
  { href: "/injectables", icon: Syringe, name: "Injectables Planner", text: "Amounts, how long they last and when to top up.", tag: "No surprises" },
  { href: "/glow-club", icon: Crown, name: "Glow Club", text: "Earn points for scans, plans and visits. Get treats.", tag: "Rewards" },
] as const;

/** Home section: the everyday tools (diary, routine, countdown, planner, club) and today's Calgary skin forecast. */
export function GlowTools() {
  return (
    <section className="chapter" id="my-glow" aria-labelledby="my-glow-title">
      <div className="container">
        <div className="mb-10 max-w-3xl md:mb-14">
          <h2 id="my-glow-title" className="text-display-md font-semibold">
            Your skin, <em className="aurora-text">every day.</em>
          </h2>
          <p className="measure mt-5 text-lede text-graphite">Free tools that work between visits. Everything stays on your phone.</p>
        </div>
        <SkinWeather className="mb-4" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TOOLS.map((t) => (
            <li key={t.href} className="lg:first:col-span-1">
              <Link href={t.href} className="surface group flex h-full flex-col rounded-[26px] p-5 transition hover:-translate-y-0.5 hover:bg-white">
                <span className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-flora-soft">
                    <t.icon className="h-5 w-5 text-flora" />
                  </span>
                  <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[11.5px] text-graphite">{t.tag}</span>
                </span>
                <span className="mt-4 block font-display text-[1.45rem] leading-tight text-ink">{t.name}</span>
                <span className="mt-1.5 block flex-1 text-[14.5px] leading-snug text-graphite">{t.text}</span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
                  Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
