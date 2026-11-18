import { parentRequest } from "@/lib/server/accounts";
import { ParentDecision } from "@/components/account/parent-decision";

export const metadata = { title: "Parent consent" };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const r = await parentRequest(t).catch(() => null);
  return (
    <div className="mx-auto max-w-md rounded-[32px] border border-ink/10 bg-white/75 p-6 md:p-8">
      {!r || r.consented_at ? (
        <>
          <h1 className="font-display text-[2rem] leading-tight">This link has ended.</h1>
          <p className="mt-2 text-graphite">It was already used, or more than 7 days have passed.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-[2rem] leading-tight">{r.name || "Your child"} wants a free NEA account.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-graphite">
            With an account they can save their face-scan numbers (never photos), plan their skincare and earn Glow Club points. No marketing emails are sent to under-18s.
          </p>
          <ParentDecision t={t} />
        </>
      )}
    </div>
  );
}
