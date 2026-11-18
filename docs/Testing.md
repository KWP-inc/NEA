# Testing and review results (update 26)

Run on the final build, 18 Nov 2026, against a production build (`npm run build && npm start`), PostgreSQL 16 and a local email catcher. How to re-run: `tests/README.md`. Full reports: `tests/out/` (made when you run them).

## Summary

| Test | Result |
| --- | --- |
| API and security (`npm run test:security`) | **88 / 88 passed** |
| Browser, phone 390×844 + desktop 1280×800 (`npm run test:e2e`) | **121 / 121 passed** |
| Links and SEO, 103 pages + 134 files (`npm run test:links`) | **0 broken links, 0 SEO issues** (see note) |
| Load, behind Nginx (`npm run test:load`) | Pages: **0 failures at 200 users at once** |
| Database security rules (RLS) | Members isolated; ledgers and audit log can't be changed |
| Backup + restore | Backup made and restored into a new database: all 20 tables and data back |
| Secrets in browser code | **None found** |
| Independent security review (separate Claude agent) | No critical issues; all 6 medium and the low findings **fixed and re-tested** |

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

## What the browser tests prove
- 24 key pages load on phone and desktop with **no JavaScript errors and no CSP blocks**; every tab on them clicks.
- **Cookie banner:** nothing is sent before "Allow"; analytics start after it.
- **Members-only:** Skin Diary asks visitors to join; Routine Builder works for visitors with a save notice.
- **Live face scan** with a fake camera face video at 72 bpm: finishes, reads **72 bpm ± 6**, and asks a visitor to join to save it.
- **Full sign-up** through the real screens (email code → details → account), then member pages, then sign-out removes access.
- **Staff page:** two-step setup with QR → backup codes → Overview, Members, Leads, Rewards, Staff, Audit log, with no errors.

## Load test

**Behind Nginx** (2 app processes, 2-CPU test machine, final build):

| Scenario | Users at once | Pages/s | Median | p97.5 | Failed |
| --- | --- | --- | --- | --- | --- |
| Home page | 200 | 1,155 | 179 ms | 331 ms | 0 |
| Treatment page | 200 | 4,230 | 44 ms | 72 ms | 0 |
| Free-scan page (poster QR) | 200 | 4,433 | 43 ms | 71 ms | 0 |
| Health check (app + database) | 100 | 681 | 122 ms | 353 ms | 0 |
| Who am I (signed out) | 100 | 977 | 83 ms | 233 ms | 0 |

- **Captcha:** Nginx set every request's IP to the real one, so the per-IP limit answered 429. This is correct, and it proves the IP can't be faked.
- **Without Nginx** (one Node process): about 300–540 pages/s; at 200 users at once about 1% of requests waited over 10 s; at 100 users at once there were no failures.
- **So:** always run behind Nginx with page caching and one Node process per core (DEPLOY.md).

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
