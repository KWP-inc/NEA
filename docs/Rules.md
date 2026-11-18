# Rules: coding standards (follow on every change)

Last updated: 18 Nov 2026

## A. Working rules from the owner
1. **Every update ships as a zip** of only new or changed files (full files), with paths from the repo root.
   - Name: `nea-update-NN-short-name.zip`.
2. **Commits go in the reply.**
   - One `git add` + `git commit -m "type(scope): message"` per logical group (feat, fix, perf, copy, docs, refactor, security), then `git push`.
3. **Say which files to delete** as `git rm <path>`.
4. **Never show the word "Jane".** Buttons say **"Book"**.
5. **No photo used twice.** Run `node scripts/check-images.mjs` after any image change.
6. **Phone first.** Check 390×844 before desktop.
7. **Super simple English** in visitor copy. Short sentences, no marketing-speak.
8. When the owner sends a doc of fixes, **fix every point**.
9. Deliver exactly what was asked. If it's unclear and expensive, ask first.

## B. TypeScript and React
- `strict` TypeScript. No `any` (use `unknown` + narrowing). `npm run typecheck` must pass.
- Server Components by default. Add `"use client"` only for camera, canvas, window or interactivity.
- Heavy client pieces load with `next/dynamic({ ssr: false })`.
- Copy and data live in `src/content/`, never hard-coded in components.
- Colours only from theme variables (`porcelain`, `ink`, `flora`, …). No raw hex in components.
- `lucide-react` stays pinned at **0.468.0**.

## C. Security: must pass before any merge

### Secrets and tokens
- [ ] API keys, DB URL and secrets only in server env. **Never `NEXT_PUBLIC_`**, never in client files, never in Git.
- [ ] Server-only modules start with `import "server-only"`.
- [ ] Nothing sensitive in `localStorage` or `sessionStorage`. Sessions are `HttpOnly` cookies only.
- [ ] No JWT secret, API key or token in logs, errors or responses.

### Every API route and server action
- [ ] Wrap the handler in `api({ auth: "public" | "session" | "user" | "staff" | "admin", limit: [name, max] }, …)` from `src/lib/server/route.ts`. It does the CSRF, rate-limit and permission checks.
- [ ] **Never trust the frontend.** Validate every input with a `zod` schema (types, lengths, enums). Reject unknown keys.
- [ ] **Stop IDOR:** never accept `userId` from the client. Look objects up together with the session user. RLS is the backup.
- [ ] Rate limit set in `api({ limit: [...] })`.
- [ ] Captcha (ALTCHA) on public forms: sign-up, sign-in, leads, parent consent.
- [ ] Mutating methods check `Origin` (CSRF).
- [ ] Return generic errors. Log details on the server only.

### Database
- [ ] **Parameterized queries only** (`q("… $1 …", [value])`). Never build SQL with string joins.
- [ ] New user-data tables: **enable RLS + add policies in the same migration.**
- [ ] Add an index for every new `where` or `order by` column used in a list.
- [ ] Money, points and consent are **insert-only ledgers**, never updated in place.

### Output and XSS
- [ ] No `dangerouslySetInnerHTML`, except JSON-LD (escaped with `<`) and the theme init script.
- [ ] Nea SI answers render as text and safe links only. Links are limited to our own paths and approved domains.
- [ ] CSP nonce on any inline script.

### Server fetches (SSRF)
- [ ] Only to hosts in `ALLOWED_HOSTS`. Never fetch a URL a user typed.
- [ ] Timeouts on every fetch (`AbortSignal.timeout`).

### Uploads
- [ ] Check type by magic bytes (JPEG, PNG, WebP), cap the size, never save face photos.
- [ ] If storage is ever needed: a **private** bucket only, with short-lived signed URLs.

### Webhooks
- [ ] Sign outgoing webhooks (HMAC). Verify incoming signatures, with a timestamp and a 5-minute window.

### Admin
- [ ] Admin pages under `ADMIN_PATH`, guarded in middleware (404 for outsiders), with MFA required.
- [ ] Every staff write calls `audit()`.

### Production
- [ ] `NODE_ENV=production`, no debug logs, no source maps served, no test routes.

## D. Privacy (Alberta PIPA)
- Collect only what the PRD lists. **Never store face photos or video.**
- Consent tick at sign-up (privacy), separate opt-in for marketing.
- Under 18: no data saved until a parent consents.
- "Delete my account" really deletes the user's rows (activity rows are anonymised).
- Analytics respect cookie consent.

## E. SEO checklist for every new page
- [ ] `pageMeta({ title, description, path })`, with a unique title (≤ 60 chars) and meta description (≤ 155 chars).
- [ ] One `<h1>`. Headings in order.
- [ ] JSON-LD where it fits (FAQPage, MedicalProcedure, BreadcrumbList).
- [ ] Added to `sitemap.ts` (public pages only) and to `llms.txt` if it matters to AI answers.
- [ ] Every image has meaningful `alt` text.

## F. Before every zip
1. `npm run typecheck`
2. `npm run build`
3. With the server running: `npm run test:security`, `npm run test:links`, `npm run test:e2e` (see tests/README.md)
4. Phone + desktop screenshots of changed screens
5. `node scripts/check-images.mjs`
6. Security checklist (section C) for changed routes
7. Zip changed files + write commits
