# Tasks: work broken into small pieces

Last updated: 18 Nov 2026 · ✅ done · ⬜ to do · ❓ needs an owner decision

Each phase ships as one or more update zips (`nea-update-NN-…`). Do the phases in order.

## Phase 0: Already done
- ✅ Full site, 23+ updates, live face scan, `/free-scan`, My Glow tools (stored on the device)
- ✅ `robots.ts` (allows AI bots, blocks `/api/`), `sitemap.ts`, `public/llms.txt`, Open Graph + Twitter tags, JSON-LD
- ✅ Security headers (nosniff, frame, referrer, HSTS, permissions), `poweredByHeader: false`
- ✅ In-memory rate limits on the AI, lens, lead, club and product routes
- ✅ Skin Lens photo: type and size check, never stored

## Phase 1: Database foundation
1. ⬜ Add `drizzle-orm`, `pg`, `drizzle-kit`, `zod`, `server-only`. Scripts: `db:generate`, `db:migrate`.
2. ⬜ `src/lib/server/db.ts`: pool + `withUser(userId, role, fn)`, which runs `SET LOCAL app.user_id/app.role` inside a transaction.
3. ⬜ Schema + migration for every table in Architecture §3.
4. ⬜ RLS migration: enable RLS, policies per table, create roles `nea_app` (no owner, no BYPASSRLS) and `nea_owner`.
5. ⬜ Indexes (Architecture §3). Monthly partitions for `activity_events` + a job to create next month's partition.
6. ⬜ A test proving user A can't read user B's rows even with a missing `where`.

## Phase 2: Accounts (built in-house)
1. ⬜ `src/lib/server/email.ts`: send through NEA's email service (❓ need SMTP or API details).
2. ⬜ Email code sign-in: request code → hash → email → verify (10 min, 5 tries, rate limits).
3. ⬜ Sessions: `__Host-nea_session` cookie, hashed in DB, sliding 30 days, `requireUser()`.
4. ⬜ Google sign-in (OIDC + PKCE + state + nonce, JWKS check). ❓ Google Cloud client id.
5. ⬜ Apple sign-in. ❓ Apple Developer account ($99 USD a year), service id, key.
6. ⬜ Age step: birth month and year. Under 18 → parent email → consent link → activate. Auto-delete after 7 days. ❓ Minimum age (suggest 13).
7. ⬜ Consents: privacy (required) and marketing (optional), with versions.
8. ⬜ Account page: profile, sign-in methods, consents, download my data (JSON), delete my account.
9. ⬜ Move device data (`glow-store` localStorage) into the account on first sign-in, then clear it from the device.
10. ⬜ Soft "create a free account" prompts after the scan, Skin Lens, Routine, Countdown and Injectables.
11. ⬜ Gate saving: Skin Diary, Glow Club, Routine, Countdown, Injectables read and write through the API when signed in.

## Phase 3: Security hardening
1. ⬜ `middleware.ts`: CSP with a nonce (Architecture §6), admin path guard (404).
2. ⬜ Escape JSON-LD (`<` → `<`) in `lib/seo.tsx`.
3. ⬜ `requireUser/Staff/Admin` + `public-routes.ts`. Audit every file in `src/app/api`.
4. ⬜ `zod` schemas on every route (`ask`, `lens`, `lead`, `club`, `product`, `skin-weather`, `reels`, `instagram`, and all new routes).
5. ⬜ CSRF origin check helper on mutating methods.
6. ⬜ Shared rate limiter: Redis if DevOps provides it, else the Postgres `rate_limits` table. Limits per IP, per user and per email.
7. ⬜ ALTCHA captcha + honeypot on sign-up, sign-in, lead forms and parent consent.
8. ⬜ Lens upload: magic-byte check (JPEG, PNG, WebP), 2 MB cap.
9. ⬜ SSRF: `ALLOWED_HOSTS` helper wrapping `fetch`, with timeouts everywhere.
10. ⬜ CORS locked to same origin. No CORS headers on the API.
11. ⬜ Sign the outgoing lead webhook (HMAC + timestamp). Add a verify helper for incoming webhooks.
12. ⬜ Nea SI output: render as text + allow-listed links only (XSS check).
13. ⬜ Prod: no debug, no source maps served, generic errors, logs without personal data.
14. ⬜ Claude security review of the whole repo (auth, IDOR, injection, XSS, CSRF, SSRF, secrets), with a report and fixes.

## Phase 4: Admin and staff page
1. ⬜ Random `ADMIN_PATH`, `noindex`, not in the sitemap, 404 for non-staff.
2. ⬜ Staff MFA: TOTP set-up with QR, 10 backup codes (hashed), required for every staff session.
3. ⬜ Members: search, view (numbers only), export CSV.
4. ⬜ Leads list + export.
5. ⬜ Glow Club: give or remove points with a reason (ledger).
6. ⬜ Activity dashboard: visitors, top pages, scan → account → Book funnel, UTM sources.
7. ⬜ Staff management (admin only): invite, change role, remove.
8. ⬜ `audit_log` on every staff write. Audit log viewer (admin only).

## Phase 5: Session analytics (first-party)
1. ⬜ `track()` client helper (batched, `sendBeacon` on page close).
2. ⬜ `POST /api/events`: validate names against a list, cap the size, rate-limit, anon id cookie.
3. ⬜ Track the key events: `page_view`, `scan_start/finish`, `lens_upload`, `si_question`, `book_click`, `signup_start/finish`, `points_earned`.
4. ⬜ Cookie-consent banner (analytics on or off). Respect Do Not Track.
5. ⬜ Daily roll-up table + 25-month retention job.

## Phase 6: Being found (SEO, AEO, GEO)
1. ⬜ **Google Search Console:** DNS TXT verification (DevOps) → submit `/sitemap.xml`.
2. ⬜ **Bing Webmaster Tools:** import from Search Console → submit the sitemap. Turn on IndexNow.
3. ⬜ Check that every page has a unique title + **meta description** (script that lists missing ones).
4. ⬜ Default **Open Graph** share image (1200×630) + per-page images for key pages.
5. ⬜ `robots.ts`: also disallow `ADMIN_PATH` and `/account`.
6. ⬜ `sitemap.ts`: add `lastModified` from content, and keep private pages out.
7. ⬜ **AEO:** short question-and-answer blocks on key pages (FAQPage JSON-LD), "How much does X cost in Calgary?" style.
8. ⬜ **GEO:**
   - update `llms.txt` with the new tools
   - add `llms-full.txt` (all treatments, prices, FAQs as plain text)
   - LocalBusiness / MedicalClinic JSON-LD with hours, address and geo
9. ⬜ Google Business Profile: check the name, address and phone match the site (❓ which phone number).

## Phase 7: Speed and scale
1. ⬜ ISR / static for content pages. `private, no-store` for account pages.
2. ⬜ Cache headers for `/media` and fonts (1 year, immutable).
3. ⬜ Move the WordPress images into `/public/media` (must happen before the domain switch).
4. ⬜ DB pool size, slow query log (> 50 ms), `EXPLAIN` the top queries.
5. ⬜ k6 load test (Architecture §11 targets) + report.
6. ⬜ Remove `vercel.json` and the Vercel-only `maxDuration` settings, and move the Instagram cron to the server.
7. ⬜ `/api/health` for uptime checks.
8. ⬜ Deployment note for DevOps (Node 20, Postgres 16 in Canada, env list, backups, migrations, HTTPS).

## Phase 8: Sales agents ❓
1. ❓ Agree what "agents to bring sales" means (options in PRD §8).
2. ⬜ Then plan it. Only for members who opted in to marketing, with human-approved templates, no invented prices or medical claims, and every send logged.

## Open questions for the owner
1. Email service details (SMTP host or API + sender address).
2. Minimum age for an account (suggest 13+, with parent consent until 18).
3. Will DevOps run Redis? (If not, rate limits use Postgres.)
4. Which phone number goes everywhere: 587-892-5722 or 1-403-230-8812?
5. What exactly should the sales agents do?
6. Real program and membership prices (still placeholders).
