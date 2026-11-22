import { PageHero } from "@/components/sections/page-hero";
import { Blocks } from "@/components/sections/blocks";
import { privacyBlocks } from "@/content/legal";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy Policy", description: "How NEA Precision Skin collects, uses and protects your personal information.", path: "/privacy" });

/** Plain-English summary of the online account, shown above the full policy. Version: 2026-11. */
function AccountPrivacy() {
  const items: [string, string][] = [
    ["What we keep", "If you make a free account: your email, first name, birth month and year, your face-scan numbers (like skin score and heart rate), your saved plans, your Glow Club points, and the choices you made below. If you allow analytics: which pages you visit and which buttons you tap on this website."],
    ["What we never keep", "Face photos or video. The live face scan runs on your phone and the picture is never sent. Skin Lens sends one photo to be read and it is thrown away straight after. Diary photos stay on your phone only."],
    ["Why", "To save your progress, give you points and rewards, run the clinic, and make the website better. Offers by email only if you tick that box."],
    ["Under 18", "You must be 16 or older to make an account. Under 18 needs a parent's yes first, and we never send marketing to under-18s."],
    ["Where it's kept", "On NEA's own secured database in Canada. Only NEA staff with two-step sign-in can see member details, and every staff action is logged."],
    ["Cookies", "One cookie keeps you signed in. With your OK, a first-party ID counts visits. No ad trackers and no selling of data."],
    ["Your choices", "Download all your data or delete your account any time from your account page. Change your email choices there too. Questions: nea@neaskincare.com or 825-395-3349."],
  ];
  return (
    <div className="mb-12 rounded-[28px] border border-ink/10 bg-white/70 p-6 md:p-8">
      <h2 className="font-display text-[1.9rem] leading-tight">Your NEA account, in plain words</h2>
      <dl className="mt-4 space-y-4">
        {items.map(([t, d]) => (
          <div key={t}>
            <dt className="font-semibold">{t}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-graphite">{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <PageHero trail={[{ name: "Privacy Policy", path: "/privacy" }]} title="Privacy Policy" />
      <section className="pb-28">
        <div className="container max-w-3xl">
          <AccountPrivacy />
          <Blocks blocks={privacyBlocks} />
        </div>
      </section>
    </>
  );
}
