# Memory: current project status

Last updated: 18 Nov 2026 · Read this first in every new session. Update it at the end of every update.

## Where we are
- **Site:** Next.js 15.5 / React 19 / TypeScript / Tailwind 3.4, now with a full backend (PostgreSQL 16, accounts, staff page). Runs locally. Not live yet.
- **Repo:** https://github.com/arshdeepsingh11/NEA (public). The owner commits and pushes from the commands we give.
- **Hosting:** NEA's DevOps person, own server and domain, in **Canada**, following `DEPLOY.md` (Nginx + PM2 + Postgres + cron). Vercel removed.
- **Old site:** WordPress still live. Before the switch: `npm run media:migrate`, then commit `public/media/wp`.
- **Demos:** `npm start` + `npx cloudflared tunnel --url http://localhost:3000` for an https link (the camera needs https). The link changes every time.
- **Last update shipped:** **#26**, the complete backend (full-repo zip). Next is **#27**.

## Decisions made (owner approved)
| Topic | Decision |
| --- | --- |
| Accounts | Free tools open; saving needs a free account. Skin Diary and Glow Club are members-only |
| Sign-in | Email + 6-digit code, Google, Apple. Built in-house |
| Email | NEA's own SMTP |
| Database | PostgreSQL in Canada, run by DevOps |
| Photos | Never stored on the server. Diary photos stay on the phone only |
| Booking | Stays in Jane. No shared login |
| Admin | Staff page at secret ADMIN_PATH, two-step sign-in required, everything audited |
| Age | **16+** for an account; **16–17 need a parent's yes** by email; no marketing to under-18s |
| Phone | **587-892-5722** everywhere (done in update 26) |
| Privacy | Owner handles it. Built to Alberta PIPA basics: consent records, minimum data, download and delete, Canada-hosted, security |
| Heart rate claims | Always "Nea SI estimate", never "measured". A certified kit (Shen.AI, NuraLogix) is an option later |
| Rate limits | Postgres-backed (no Redis needed) |
| CSP | Allows inline scripts (Next.js needs them) so pages stay cached; everything else locked |
| Sales agents | After the site is live |

## Key places in the code
- Server code: `src/lib/server/` (db, auth, accounts, oauth, staff, glow, http, route, captcha, rate-limit, email, csv, audit, webhooks)
- API: `src/app/api/{auth,me,staff,events,lead,health,cron}`
- Pages: `src/app/account/*`, `src/app/staff-portal/*` (reached only via ADMIN_PATH)
- Migrations: `db/migrations/*.sql`. Deploy: `deploy/`, `DEPLOY.md`. Tests: `tests/` (see tests/README.md)

## Open questions
1. Real prices (programs, memberships, partner commission) and Glow Club rewards: still placeholders.
2. Google and Apple developer accounts (only if those buttons are wanted).
3. "Claude sales agents": after launch.

## Change log
| # | Date | What |
| --- | --- | --- |
| 24 | 17 Nov 2026 | `/free-scan` page, Nea SI estimate labels, scan intro overlap fix, clear https camera message |
| 25 | 18 Nov 2026 | Project docs: PRD, Architecture, Rules, Design, Tasks, Memory |
| 26 | 18 Nov 2026 | Full backend: Postgres + RLS, accounts (email code, Google, Apple, 16+, parent consent), My Glow saved to accounts, staff page with MFA and audit log, first-party analytics + cookie banner, security hardening, SEO (share image, fitted meta, llms-full, IndexNow, verification), phone 587-892-5722, self-hosted fonts, Nginx/PM2/backups/DEPLOY.md, test suites (security 88, browser 121, links, load) + independent security review, all findings fixed |
