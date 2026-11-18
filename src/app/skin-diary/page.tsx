import { MembersOnly } from "@/components/account/members-only";
import { PageHero } from "@/components/sections/page-hero";
import { SkinDiary } from "@/components/glow/skin-diary";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Skin Diary: track your skin score week by week",
  description: "Scan your face with your phone and track your skin score, water, redness and more over time, with a before and after of your own photos. Free with an NEA account. Photos stay on your phone.",
  path: "/skin-diary",
});

export default function Page() {
  return (
    <>
      <PageHero trail={[{ name: "Skin Diary", path: "/skin-diary" }]} title="Your Skin Diary." lede="Every face scan, saved to your free account. Watch your skin score change week by week." className="!pb-8 md:!pb-12" />
      <section className="pb-28">
        <div className="container">
          <MembersOnly feature="Skin Diary" text="Save every face scan and watch your skin score change week by week. Your scores are kept in your account; photos stay on your phone.">
            <SkinDiary />
          </MembersOnly>
        </div>
      </section>
    </>
  );
}
