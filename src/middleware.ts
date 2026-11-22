import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. The staff page lives at a secret path (ADMIN_PATH, e.g. /staff-7f3k2a). Requests there are quietly
 *    rewritten to the internal /staff-portal pages. Going to /staff-portal directly is a plain 404,
 *    so the real address can't be guessed from the code.
 * 2. Private pages (staff, account) are marked noindex for search engines.
 * Real permission checks happen on the server for every page and API call (see src/lib/server/auth.ts).
 */
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|media/|magazine/|models/|brand/|videos/|favicon|icon|robots.txt|sitemap.xml|llms).*)"],
};

const INTERNAL = "/staff-portal";
// Next.js runs middleware again on the rewritten request. This random key (new each time the server starts,
// never sent to browsers) marks our own rewrite, so only the secret ADMIN_PATH can reach /staff-portal.
const INTERNAL_KEY = globalThis.crypto.randomUUID();
const KEY_HEADER = "x-nea-internal";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const admin = (process.env.ADMIN_PATH || "").replace(/[^a-zA-Z0-9-]/g, "");

  if (pathname === INTERNAL || pathname.startsWith(`${INTERNAL}/`)) {
    if (admin && req.headers.get(KEY_HEADER) === INTERNAL_KEY) return NextResponse.next();
    return new NextResponse("Not found", { status: 404 });
  }

  if (admin && (pathname === `/${admin}` || pathname.startsWith(`/${admin}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = INTERNAL + pathname.slice(admin.length + 1);
    const headers = new Headers(req.headers);
    headers.set(KEY_HEADER, INTERNAL_KEY);
    const res = NextResponse.rewrite(url, { request: { headers } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  if (pathname.startsWith("/account")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  return NextResponse.next();
}
