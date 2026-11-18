import { GuestSaveNotice } from "@/components/account/guest-save-notice";
import { PageHero } from "@/components/sections/page-hero";
import { InjectablesPlanner } from "@/components/glow/injectables-planner";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Injectables Planner: amounts, how long they last and top-ups",
  description: "Plan wrinkle relaxers and fillers area by area: typical amounts, how long results last, recovery time and top-up dates, then book a consult with a licensed NEA injector in Calgary.",
  path: "/injectables",
});

export default function Page() {
  return (
    <>
      <PageHero trail={[{ name: "Injectables Planner", path: "/injectables" }]} title="Plan your injectables, with no surprises." lede="Tap an area of the face. See what's usually used, how much, how long it lasts and when a top-up is due." className="!pb-8 md:!pb-12" />
      <section className="pb-28">
        <div className="container">
          <GuestSaveNotice what="plan" />
          <InjectablesPlanner />
        </div>
      </section>
    </>
  );
}
