/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    // keep optimised images for 30 days so the server rarely has to fetch them again
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "https", hostname: "neaprecisionskin.com", pathname: "/wp-content/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "bioarolabs.com", pathname: "/pdp/**" },
    ],
  },
  poweredByHeader: false,
  // no source maps served to browsers in production
  productionBrowserSourceMaps: false,
  async headers() {
    /**
     * Security headers on every response.
     * CSP: only our own scripts, plus the face-tracking library (MediaPipe) from jsDelivr. Next.js needs
     * small inline scripts, so 'unsafe-inline' stays for scripts; everything else is locked down
     * (no plugins, no other sites framing us, forms post only to us, no base-tag tricks).
     * The camera is allowed for this site only (live scan, mirror, Skin Lens, barcode scan).
     */
    const csp = [
      "default-src 'self'",
      // only the exact MediaPipe face-tracking package, not all of jsDelivr
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://neaprecisionskin.com https://images.unsplash.com https://bioarolabs.com https://*.openbeautyfacts.org https://*.openfoodfacts.org https://*.openproductsfacts.org",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "connect-src 'self' https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/ https://storage.googleapis.com/mediapipe-models/ https://nominatim.openstreetmap.org",
      "worker-src 'self' blob:",
      "frame-src https://www.instagram.com https://www.youtube-nocookie.com https://www.tiktok.com",
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com https://appleid.apple.com",
      "base-uri 'self'",
      "object-src 'none'",
      // only on the real https site (it would break plain-http local testing)
      ...((process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];
    const year = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    const day = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/:path*", headers: security },
      // API answers are private and never cached unless a route says otherwise
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
      // big static files: cached for a year (rename a file to change it)
      { source: "/media/:path*", headers: year },
      { source: "/magazine/:path*", headers: year },
      { source: "/models/:path*", headers: year },
      { source: "/videos/:path*", headers: year },
      { source: "/brand/:path*", headers: day },
      { source: "/llms.txt", headers: day },
    ];
  },
  async redirects() {
    // Keep every old WordPress URL working after the relaunch (SEO equity).
    return [
      { source: "/our-treatments-skin-health", destination: "/treatments?focus=skin", permanent: true },
      { source: "/our-treatments-health-wellness", destination: "/treatments?focus=wellness", permanent: true },
      { source: "/our-treatments-fitness", destination: "/treatments?focus=body", permanent: true },
      { source: "/our-treatments-arthritis", destination: "/packages#arthritis", permanent: true },
      { source: "/our-treatments-injectables", destination: "/treatments?focus=injectables", permanent: true },
      { source: "/our-treatments-feminine-health", destination: "/treatments/feminine-health", permanent: true },
      { source: "/our-treatments-microbiome-testing", destination: "/microbiome", permanent: true },
      { source: "/wellness-packages", destination: "/packages", permanent: true },
      { source: "/weight-loss-program", destination: "/weight-loss", permanent: true },
      { source: "/fotona-laser", destination: "/fotona", permanent: true },
      { source: "/our-biogut-nutrition-clinic", destination: "/nutrition", permanent: true },
      { source: "/our-mission", destination: "/about#mission", permanent: true },
      { source: "/frequently-asked-questions", destination: "/faq", permanent: true },
      { source: "/consultation", destination: "/book", permanent: true },
      { source: "/clinic-gallery", destination: "/gallery", permanent: true },
      { source: "/download-nea-magazine", destination: "/magazine", permanent: true },
      { source: "/get-bionow-magazine", destination: "/magazine#bionow", permanent: true },
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/terms-of-service", destination: "/terms", permanent: true },
      { source: "/coupon20", destination: "/skin-scan", permanent: false },
    ];
  },
};

export default nextConfig;
