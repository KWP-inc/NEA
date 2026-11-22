# Testing and review results (update 27)

Run on the final build, 21 Nov 2026, against a production build (`npm run build && npm start`), PostgreSQL 16 and a local email catcher. How to re-run: `tests/README.md`. Full reports: `tests/out/` (made when you run them).

## Summary

| Test | Result |
| --- | --- |
| API and security (`npm run test:security`) | **89 / 89 passed** |
| Browser with Playwright, phone 390×844 + desktop 1280×800 (`npm run test:e2e`) | **143 / 143 passed** |
| Browser with Selenium, phone + desktop (`npm run test:selenium`) | **59 / 59 passed** |
| Links and SEO, 104 pages + 136 files (`npm run test:links`) | **0 broken links, 0 SEO issues** (see note) |
| Speed, Lighthouse (`npm run test:perf`) | Computer **82–99**, phone **50–75** (see below) |
| Load, behind Nginx (`npm run test:load`) | Pages and APIs: **0 failures at 200 users at once** |
| Database security rules (RLS) | Members isolated; ledgers and audit log can't be changed |
| Secrets in browser code | **None found** |

**Note on links:** 49 photos still load from the old WordPress site, which the test machine couldn't reach. They are not broken today, but they **will** break when WordPress goes away: run `npm run media:migrate` before the domain switch (DEPLOY.md §3).

## What the security tests prove
- **Sign-up:** a captcha is needed; under 16 is refused; 16–17 wait for a parent's email yes; the consent link works once; no marketing for under-18s.
- **Cookies:** HttpOnly, SameSite=Lax, Secure with the `__Host-` prefix in production.
- **Points:** given only by the server: once, once a day, or a valid clinic code (once per member, one a week); phone imports are capped at 100; rewards need enough points; races are blocked.
- **IDOR:** member B can't see or delete member A's data; members get 404 on every staff API.
- **CSRF:** requests from another site, or with no Origin, are refused.
- **Injection:** SQL injection (quotes, type tricks, staff search), broken JSON, XSS text (stored as text, escaped on output), CSV formula injection (neutralised).
- **Captcha:** can't be replayed; the honeypot works.
- **Uploads:** a fake JPEG (wrong magic bytes) and SVG are refused; the photo field is never stored.
- **Rate limits:** API floods get 429; 20 wrong sign-in codes for one email (from many IPs) lock that email for a day.
- **Hidden admin:** `/staff-portal` and the secret path are 404 for visitors and members.
- **Staff two-step:** required; QR setup; wrong codes refused; a used code can't be replayed; 5 wrong codes lock for 15 minutes; a new session token after it.
- **Staff actions:** staff can't give themselves points; front-desk rewards can't be used twice; the audit log records every action.
- **Database rules:** a member can't make themselves admin, add points or create a session, even with direct SQL; staff can't change roles.
- **Your data:** download works with no photos; delete needs the word DELETE, removes everything, and anonymises activity.
- **Hidden routes:** maintenance and Instagram routes are hidden without the secret; no CORS for other sites.

## What the update 27 tests prove (phone complaints)
- **No stuck photos:** on a phone, nothing with a photo stays pinned while the page scrolls (the Skin Twin photo used to).
- **Native phone scrolling:** the smooth-scroll library is off on touch screens (it fought the finger and the pinned parts).
- **Gallery** on phones is a simple swipe row (the 3D sphere pinned the screen).
- **Glow Feed** on phones is a vertical swipe feed like Instagram Reels; swiping up shows the next video.
- **Accounts:** separate **Sign in** and **Create account** tabs; a returning member signs in with the email code and goes straight to their account (no sign-up form).
- **Content:** The Perfect Peel text on Facials; the full Large Pores plan; Rosacea is "a skin condition"; the new phone number everywhere and the old one nowhere.
- **Staff page** opens for an admin after two-step (a Next.js change had broken it: fixed), and `/staff-portal` stays 404 even with a guessed internal header.

## What the browser tests prove
- 24 key pages load on phone and desktop with **no JavaScript errors and no CSP blocks**; every tab on them clicks.
- **Cookie banner:** nothing is sent before "Allow"; analytics start after it.
- **Members-only:** Skin Diary asks visitors to join; Routine Builder works for visitors with a save notice.
- **Live face scan** with a fake camera face video at 72 bpm: finishes, reads **72 bpm ± 6**, and asks a visitor to join to save it.
- **Full sign-up** through the real screens (email code → details → account), then member pages, then sign-out removes access.
- **Staff page:** two-step setup with QR → backup codes → Overview, Members, Leads, Rewards, Staff, Audit log, with no errors.

## Speed (Lighthouse, the engine behind PageSpeed Insights)

Phone = Lighthouse's standard test: slow 4G and a 4× slower processor. Desktop = fast network.

| Page | Phone before | Phone now | Desktop now |
| --- | --- | --- | --- |
| Home | 42 | **50–53** | 82 |
| Treatments | 64 | 61–64 | 94 |
| Facials | 65 | **75** | 98 |
| Skin Lens | 67 | 70 | 96 |
| Blog | 69 | 70 | 97 |
| Newsletters | – | 73 | 97 |

What changed on phones (the "glitchy" feel):
- **Background blur:** 106 blurred layers on the home page → **none** on cards (a near-solid colour instead). Blur made the phone redraw the page on every scroll frame.
- **Download:** home page **3.7 MB → 0.9 MB** (the hero video loads only when you reach it, and phones get a 0.5 MB copy instead of 2.9 MB).
- **Processor busy while idle:** **54% → 30%**. Six endless animations now pause when off screen or when the tab is hidden; the Skin Twin photo is redrawn only when a slider moves; the hero drop runs at 30 fps on phones.
- **Accessibility (home, phone):** 84 → **93** (contrast, labels, list structure).
- Lighthouse's own measured first paint is **0.6 s**; its phone score adds a simulated slow-4G download of ~35 script files. Check the real site with https://pagespeed.web.dev after launch.
- **Sign-in page SEO 54 is on purpose:** account pages are hidden from Google (`noindex`).

## Load test

**Behind Nginx with page caching** (as in production; 2-CPU test machine, final build), 15 s per test:

| Scenario | Users at once | Requests/s | Median | p97.5 | Failed |
| --- | --- | --- | --- | --- | --- |
| Home page | 200 | 927 | 215 ms | 461 ms | 0 |
| Treatment page | 200 | 3,015 | 66 ms | 92 ms | 0 |
| Free-scan page (poster QR) | 200 | 3,628 | 54 ms | 78 ms | 0 |
| Newsletters page | 200 | 3,959 | 49 ms | 76 ms | 0 |
| Instagram feed list | 100 | 662 | 122 ms | 185 ms | 0 |
| Health check (app + database) | 100 | 625 | 142 ms | 282 ms | 0 |
| Who am I (signed out) | 100 | 647 | 137 ms | 201 ms | 0 |

- **Captcha:** every test request came from one IP, so the per-IP limit answered 429. Correct: the IP can't be faked.
- **Without Nginx** (one Node process): APIs pass; pages manage 260–560/s and about 1% of requests are still waiting when the test stops. So always run behind Nginx (DEPLOY.md).
- **Found and fixed:** an old cached page (old phone number) was served after a rebuild because the Nginx cache wasn't cleared. `deploy/release.sh` now clears it and **fails the release** if the live page isn't the new build.

## Independent security review: findings and fixes

| # | Finding | Severity | Fix (all re-tested) |
| --- | --- | --- | --- |
| 1 | `next=` after sign-in could jump to another site (`/\evil.com`) | Medium | The browser resolves the URL and the origin must be ours; strict pattern |
| 2 | Deleting an account didn't anonymise activity rows | Medium | Done by server code; the DB rule allows only clearing `user_id` |
| 3 | Sign-in codes could be guessed slowly over weeks | Medium | 20 wrong codes per email per day, from any IP, then locked |
| 4 | Staff two-step: no per-person lockout, code reusable | Medium | 5 wrong codes → 15 min lock; each code works once; backup codes are removed in the same step |
| 5 | Rate limits could be dodged by faking the IP header | Medium | App listens on 127.0.0.1 only; Nginx sets X-Real-IP |
| 6 | Clinic codes could be reused daily for free points | Medium | Each code once per member, at most one a week (unique index) |
| 7 | Smaller issues: import points, staff self-points, staff Google/Apple linking, age rounding, line breaks in subjects | Low | Import cap 100; self-points blocked; staff must use the email code; strict age; line breaks stripped |
| 8 | Hardening: database too permissive in places | — | Trigger guards role/status; only server code adds points, sessions and rewards; staff can't change roles |
| 9 | Hardening: CSP allowed all of jsDelivr | — | Pinned to the exact MediaPipe package and model paths |
| 10 | Hardening: request bodies read before the size check | — | Bodies stream with a byte cap |
| 11 | Hardening: cookies shared one signing format | — | A purpose label is now inside the signature |

**Accepted on purpose:** the CSP allows inline scripts. Next.js needs them, and a nonce would make every page render per request and lose the page caching. React escapes all output, and the other CSP rules are strict.

## Not testable here (do on the real server)
- Real iPhone and Android over https: live scan with MediaPipe, sign-in, staff two-step.
- Real SMTP delivery (SPF/DKIM/DMARC), Google and Apple sign-in (need their developer accounts).
- Weather and product lookups (their sites aren't reachable from the test machine; both fail safely).
