# Tasks: work broken into small pieces

Last updated: 18 Nov 2026 (update 26) · ✅ done · ⬜ to do · ❓ needs an owner decision

## ✅ Phase 1: Database
- ✅ PostgreSQL 16 schema: users, sign-in, sessions, parent consent, consents, staff MFA, scans, My Glow docs, points ledger, rewards, leads, activity (monthly partitions), daily totals, audit log, rate limits
- ✅ Row Level Security on every table. The website role `nea_app` can't bypass it. Tested: a member can't read or change another member's rows, even with no `WHERE`
- ✅ Points ledger, consents and audit log are insert-only (no update or delete grant)
- ✅ Indexes for every list and lookup
- ✅ `npm run db:migrate`, `npm run db:maintain` (daily housekeeping), `npm run db:backup` (tested restore)

## ✅ Phase 2: Accounts (built in-house)
- ✅ Email + 6-digit code (hashed, 10 min, 5 tries, rate-limited, captcha)
- ✅ Google and Apple sign-in (OIDC with state, nonce, PKCE; ID token checked). Buttons appear when the keys are set
- ✅ Sessions in HttpOnly, Secure, SameSite cookies, stored hashed, 30-day sliding expiry
- ✅ Age: **16+** only. 16–17 need a parent's yes by email. Unconfirmed child accounts are deleted after 7 days. No marketing to under-18s
- ✅ Consents (privacy required, marketing optional), kept as proof
- ✅ Account page: name, offer emails, Glow Club code, **Download my data**, **Delete my account**, sign out
- ✅ Data already on the phone moves into the account on first sign-in (points capped at 300)
- ✅ "Create a free account" prompts after the live scan and on the tools. Skin Diary and Glow Club are members-only. Routine, Countdown and Injectables can be tried free, and saving needs an account

## ✅ Phase 3: Security
- ✅ One `api()` wrapper on every new route: CSRF origin check, shared rate limit, server-side permission check, generic errors
- ✅ zod schemas on every input. Parameterized SQL only
- ✅ ALTCHA captcha (self-hosted) + honeypot on sign-in and every form. Each puzzle works once
- ✅ CSP + security headers. JSON-LD escaped. CSV exports neutralise formulas
- ✅ Skin Lens uploads checked by magic bytes (JPEG, PNG, WebP), size-capped, never stored
- ✅ Server fetches only to an allow-list of hosts (SSRF)
- ✅ Lead webhook signed (HMAC + timestamp). `verifyWebhook()` for incoming webhooks
- ✅ Rate limits use the IP that Nginx sets (`X-Real-IP`), so visitors can't fake it
- ✅ No secrets in browser code (scanned)
- ✅ Independent security review by a separate Claude agent (see docs/Testing.md)

## ✅ Phase 4: Staff page
- ✅ Secret `ADMIN_PATH`. `/staff-portal` and the secret path answer 404 to anyone who isn't staff
- ✅ Two-step sign-in (authenticator app + 10 backup codes), with a new session token after it
- ✅ Overview (funnel, visitors per day, top pages, sources, devices), Members (search, detail, give or take points, CSV), Leads (filter, CSV), Rewards (front desk lookup, mark used), Staff (admin: add, remove, reset two-step), Audit log (admin)
- ✅ Every staff change and export goes to the insert-only audit log

## ✅ Phase 5: Analytics (first-party)
- ✅ Cookie banner (Allow / Only essential). Nothing is sent before "Allow". Do Not Track respected. Staff pages never counted
- ✅ Events: page views, scan start and finish, Book taps, Nea SI opens, join-card views and clicks, sign-ups, leads
- ✅ Monthly partitions, daily roll-up, raw events dropped after 25 months

## ✅ Phase 6: Being found
- ✅ Meta description and title on every page, auto-fitted to Google's length
- ✅ Share image (1200×630) on every page
- ✅ robots.txt keeps private pages out. AI answer bots welcomed
- ✅ `llms.txt` updated, plus `/llms-full.txt` (every program, treatment and FAQ)
- ✅ Search Console and Bing verification by env (or DNS). IndexNow key + `npm run seo:indexnow`
- ✅ Phone number is now **587-892-5722** everywhere (site, schema, llms, old blog text)

## ✅ Phase 7: Speed and deployment
- ✅ Public pages are static and cached. Fonts are self-hosted (no Google call)
- ✅ Nginx config with page caching, HTTPS and real-IP. PM2 config (1 process per core). DEPLOY.md
- ✅ Load tested (docs/Testing.md). Health check `/api/health`
- ✅ Vercel files removed. Cron moved to the server

## ⬜ Still to do
1. ⬜ **DevOps:** follow DEPLOY.md (database, env, Nginx, PM2, cron, SPF/DKIM/DMARC for email)
2. ⬜ **Before the domain switch:** `npm run media:migrate` on a machine with internet, then commit `public/media/wp` (49 photos still load from WordPress)
3. ⬜ Test on a real iPhone and Android phone over https (live scan, sign-in, staff two-step)
4. ⬜ Google and Apple developer accounts, if those buttons are wanted
5. ❓ Real prices for programs, memberships and partner commission (still placeholders)
6. ❓ Glow Club rewards and points (placeholders in `src/content/club.ts`)
7. ❓ Sales agents: decide after launch (PRD §8)
8. ⬜ After launch: submit the sitemap in Search Console and Bing, run IndexNow
