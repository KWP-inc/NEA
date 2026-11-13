import { PageHero } from "@/components/sections/page-hero";
import { GlowClub } from "@/components/glow/glow-club";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Glow Club: earn points, get rewards at NEA",
  description: "Earn Glow points for face scans, skin plans, clinic visits and inviting friends, then trade them for rewards at NEA Precision Skin in Calgary. No account needed.",
  path: "/glow-club",
});

export default function Page() {
  return (
    <>
      <PageHero trail={[{ name: "Glow Club", path: "/glow-club" }]} title="Glow Club." lede="Earn points for looking after your skin. Trade them for treats at NEA." className="!pb-8 md:!pb-12" />
      <section className="pb-28">
        <div className="container">
          <GlowClub />
        </div>
      </section>
    </>
  );
}
