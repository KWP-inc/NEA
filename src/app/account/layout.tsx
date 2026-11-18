import type { Metadata } from "next";

/** Account pages are private: never indexed, never cached. */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <section className="container min-h-[80svh] pb-32 pt-28 md:pt-32">{children}</section>;
}
