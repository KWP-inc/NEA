import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Footer } from "@/components/layout/footer";
import { Dock } from "@/components/layout/dock";
import { AiProvider } from "@/components/ai/ai-provider";
import { BookingProvider } from "@/components/booking/booking";
import { ReelsProvider } from "@/components/reels/reels";
import { BrandCorner } from "@/components/layout/brand-corner";
import { MirrorLazy } from "@/components/face/mirror-lazy";
import { LiveScanLazy } from "@/components/scan/live-scan-lazy";
import { RefCapture } from "@/components/glow/ref-capture";
import { AccountProvider } from "@/components/account/account-provider";
import { ConsentBanner } from "@/components/account/consent-banner";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { PauseOffscreen } from "@/components/layout/pause-offscreen";
import { JsonLd, clinicSchema } from "@/lib/seo";
import { site } from "@/lib/site";
import { themeInitScript } from "@/components/theme/init";

// Editorial serif for headlines (Aesop / luxury feel), Inter for everything you read and tap.
// Self-hosted (SIL Open Font License, see src/app/fonts): no call to Google at build time or in the browser.
const display = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});
const sans = localFont({
  src: [
    { path: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Healthy skin starts inside · Calgary`, template: `%s | ${site.name}` },
  description: "Physician-managed skin and wellness clinic in NE Calgary. Fotona laser, injectables and medical-grade skincare, plus gut and skin microbiome testing. Free skin scan.",
  applicationName: site.name,
  keywords: [
    "skin clinic Calgary",
    "medical aesthetics Calgary NE",
    "Fotona laser Calgary",
    "acne treatment Calgary",
    "pigmentation treatment brown skin Calgary",
    "melasma Calgary",
    "PRP hair restoration Calgary",
    "microbiome testing Calgary",
    "registered dietitian skin",
    "gut health skin",
  ],
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: site.name,
    title: `${site.name} — Healthy skin starts inside`,
    description: site.description,
    images: [{ url: "/og/nea-share.jpg", width: 1200, height: 630, alt: `${site.name}: Healthy skin starts inside` }],
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description, images: ["/og/nea-share.jpg"] },
  // Search Console and Bing Webmaster Tools: paste each tool's verification code into the server env
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  category: "health",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBFC" },
    { media: "(prefers-color-scheme: dark)", color: "#FDFBFC" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" data-theme="pearl" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[#060912]">
          Skip to content
        </a>
        <div aria-hidden className="aurora-bg">
          <div className="aurora-grid" />
          <div className="aurora-noise" />
        </div>
        <JsonLd data={clinicSchema()} />
        <SmoothScroll />
        <PauseOffscreen />
        <AccountProvider>
        <BookingProvider>
          <AiProvider>
            <ReelsProvider>
              <BrandCorner />
              <main id="main">{children}</main>
              <Footer />
              <Dock />
              <MirrorLazy />
              <LiveScanLazy />
              <RefCapture />
              <ConsentBanner />
            </ReelsProvider>
          </AiProvider>
        </BookingProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
