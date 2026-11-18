# PRD: NEA Precision Skin website + member accounts

Last updated: 18 Nov 2026 · Owner: Arsh (final say on everything)

## 1. Why we are building this

NEA Precision Skin is a physician-managed skin and wellness clinic in NE Calgary. The new website replaces the old WordPress site.

Goals:
1. **More bookings.** Every page leads to one clear **Book** button.
2. **Free scan offer.** Drive people to the free in-clinic skin scan (normally $150).
3. **Members.** Turn visitors into members with free accounts, so they come back.
4. **First-party data.** Learn what visitors do, so NEA can market better.
5. **Be found.** Rank on Google and Bing, and get picked up by AI answer engines (ChatGPT, Perplexity, Gemini, Claude).

## 2. Who uses it

| User | What they want |
| --- | --- |
| Visitor (no account) | Try the scan, ask Nea SI, see prices, book |
| Member (free account) | Save scans, track their skin, earn Glow Club points, plan treatments |
| Minor (under 18) | Same as a member, **only after a parent says yes** |
| NEA staff | See members, leads, scans, points and activity. Give points |
| Admin (Arsh / owner) | Everything staff can do, plus manage staff and settings |

## 3. What is free and what needs an account

| Free, no account | Needs a free account |
| --- | --- |
| Live face scan (one result) | Save scans to the **Skin Diary** and see changes over time |
| Skin Lens (one selfie) | **Glow Club** points and rewards |
| Nea SI chat | **Routine Builder** saved routine |
| All treatment, program, package and price pages | **Event Countdown** and **Injectables Planner** saved plans and reminders |
| Booking (in Jane) | Member perks and their own NEA plan |

- After each free tool, show a soft prompt: *"Create a free account to save this to your Skin Diary."*
- Never block the first try behind sign-up.
- When someone signs up, move anything already saved on their device into their account.

## 4. Sign-up and log-in

- **Email + 6-digit code** (no password). The code is sent by NEA's own email service.
- **Google** and **Apple** sign-in.
- **Age check at sign-up:**
  - Ask for birth month and year.
  - **Under 18:** enter a parent's email. The parent gets a consent link. The account only saves data after the parent says yes.
  - Unconfirmed child accounts are deleted after 7 days.
- **Consent at sign-up:** a tick box for the privacy policy. A separate, optional tick box for marketing emails.
- **Delete my account:** a button in account settings that deletes all of the user's data.

## 5. Data we keep

- **Account:** email, name, birth month and year, sign-in method, consents.
- **Scan results as numbers only:** skin score, heart rate, stress, water, redness, and so on.
- **NEVER face photos or video.** Photos used by Skin Lens are analysed and thrown away.
- **Skin Diary, routines, plans and Glow Club points.**
- **Activity events:** pages viewed, buttons tapped, scans started and finished, Book clicks, Nea SI questions, sign-ups, plus UTM source.
- **Booking stays in Jane.** We can't log people into Jane. We only pre-fill their name and email.

## 6. Admin and staff page

- Hidden URL, staff-only login, **MFA required**.
- Shows:
  - members (search, view, export CSV)
  - leads from forms
  - scans (numbers only)
  - Glow Club points (give or remove points, with a reason)
  - activity charts (top pages, funnel from scan to Book click, sources)
  - staff list (admin only)
- Every staff action is logged.

## 7. Being found (SEO, AEO, GEO)

- **Already done:** sitemap, robots.txt, llms.txt, Open Graph, JSON-LD, redirects from the old URLs.
- **To do:**
  - Google Search Console and Bing Webmaster Tools verification
  - a meta description on every page
  - a default share image
  - FAQ answers written for AI engines (AEO)
  - llms.txt and llms-full.txt kept up to date (GEO)

## 8. Sales agents (open question)

- The owner wants AI agents (for example built on Claude) that help bring sales.
- **What this means is still to be agreed.** Options:
  - follow-up emails to new members and leads
  - abandoned-booking nudges
  - a smarter Nea SI that books
  - a weekly sales report for staff
- **Rules:** agents never send anything to a customer without a consent record, and never invent prices or medical claims.

## 9. Non-goals (not now)

- Payments on the site (BioAro Labs and Jane handle payments)
- A mobile app
- Replacing Jane
- Diagnosing anything

## 10. Success measures

| Measure | Target (first 3 months after launch) |
| --- | --- |
| Visitors who try a free tool | 25% |
| Free tool → account sign-up | 10% |
| Book clicks per month | Up 50% on the old site |
| Pages indexed in Google | All public pages |
| Security issues found in review | 0 high or critical open at launch |

## 11. Rules that never change

- Simple English, phone-first, one Book button.
- Never show the word "Jane".
- No photo used twice on the site.
- Everything is a wellness estimate, not a medical test.
- Never store photos.
- Keys stay on the server only.
