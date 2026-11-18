# Memory: current project status

Last updated: 18 Nov 2026 · Read this first in every new session. Update it at the end of every update.

## Where we are
- **Site:** Next.js 15.5 / React 19 / TypeScript / Tailwind 3.4. Runs **locally only**. Not live yet.
- **Repo:** https://github.com/arshdeepsingh11/NEA (public). The owner commits and pushes from the commands we give.
- **Hosting later:** NEA's DevOps person, on NEA's own server and domain, in **Canada**. Vercel was only a showcase and will be deleted.
- **Old site:** WordPress is still live on neaprecisionskin.com. The domain switch happens when the new site is ready. Move the WordPress images first.
- **Demos:** run `npm start` + `npx cloudflared tunnel --url http://localhost:3000` to get an `https` link (needed for the camera on phones). The link changes every time.
- **Last update shipped:** #24 (`/free-scan` page, "Nea SI estimate" labels, intro overlap fix). Next is **#25**.

## Decisions made (owner approved)
| Topic | Decision |
| --- | --- |
| Accounts | Yes. Free tools stay open, and saving needs a free account |
| Sign-in | Email + 6-digit code, Google, Apple. Built in-house, no paid auth service |
| Email | NEA's own email service (details still needed) |
| Database | **PostgreSQL**, run by DevOps, in Canada |
| Photos | **Never store face photos or video.** Numbers only |
| Booking | Stays in Jane. We only pre-fill details. No shared login |
| Admin | Yes, a staff and admin page, owner has full access |
| Minors | Allowed with **parent consent** |
| Privacy | Owner handles privacy themselves (no separate privacy officer). We build to Alberta PIPA basics: consent, minimum data, delete my account, security |
| Heart rate claims | Always "Nea SI estimate", never "measured" or "accurate". A certified kit (Shen.AI, NuraLogix) is an option later |
| Docs | PRD, Architecture, Rules, Design, Tasks, Memory live in `/docs` |

## What exists now (not yet built: see Tasks.md)
- **Done:**
  - robots, sitemap, llms.txt, OG, JSON-LD
  - security headers (no CSP yet)
  - in-memory rate limits
  - My Glow tools saving to **localStorage** (no accounts yet)
- **No database, no accounts, no admin, no captcha, no analytics yet.**

## Open questions
1. Email service SMTP or API details.
2. Minimum age (suggest 13).
3. Redis available from DevOps?
4. Phone number: 587-892-5722 (poster) vs 1-403-230-8812 (site).
5. "Claude sales agents": what exactly?
6. Real prices (programs, memberships, partner commission).

## Next step
Phase 1 (database foundation) → Phase 2 (accounts) → Phase 3 (security), as in `docs/Tasks.md`.

## Change log
| # | Date | What |
| --- | --- | --- |
| 24 | 17 Nov 2026 | `/free-scan` page, Nea SI estimate labels, scan intro overlap fix, clear https camera message |
| 25 | 18 Nov 2026 | Project docs: PRD, Architecture, Rules, Design, Tasks, Memory |
