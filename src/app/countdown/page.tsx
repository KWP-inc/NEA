import { PageHero } from "@/components/sections/page-hero";
import { EventCountdown } from "@/components/glow/event-countdown";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Event Countdown: a week-by-week skin plan for your big day",
  description: "Wedding, vacation or birthday coming up? Enter the date and get a safe week-by-week skin plan: what to do now, what to book when, and what to skip. Free from NEA Precision Skin, Calgary.",
  path: "/countdown",
});

export default function Page() {
  return (
    <>
      <PageHero trail={[{ name: "Event Countdown", path: "/countdown" }]} title="Glow on the day that matters." lede="Tell us the date. Get a week-by-week skin plan that fits the time you have." className="!pb-8 md:!pb-12" />
      <section className="pb-28">
        <div className="container">
          <EventCountdown />
        </div>
      </section>
    </>
  );
}
