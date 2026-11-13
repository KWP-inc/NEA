import { PageHero } from "@/components/sections/page-hero";
import { RoutineBuilder } from "@/components/glow/routine-builder";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Routine Builder: check your skincare products",
  description: "Scan the barcodes of your skincare products or add them by name. See the right morning and night order, which products clash, and what is missing. Free from NEA Precision Skin, Calgary.",
  path: "/routine",
});

export default function Page() {
  return (
    <>
      <PageHero trail={[{ name: "Routine Builder", path: "/routine" }]} title="Is your routine helping your skin?" lede="Scan or add the products you use. See the right order for morning and night, what clashes and what's missing." className="!pb-8 md:!pb-12" />
      <section className="pb-28">
        <div className="container">
          <RoutineBuilder />
        </div>
      </section>
    </>
  );
}
