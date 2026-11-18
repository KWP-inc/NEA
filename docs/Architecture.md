# Architecture

Last updated: 18 Nov 2026 (built in update 26)

## 1. Big picture

```
Phone / browser
   │  HTTPS only
   ▼
Next.js 15 app (Node 20, `next start`)       ← one codebase: pages + API routes
   │  server-only code (never sent to browser)
   ├── PostgreSQL 16 (Canada)                ← accounts, scans, points, activity, audit log
   ├── NEA email service (SMTP or API)       ← sign-in codes, parent consent, reminders
   ├── Google / Apple sign-in (OIDC)
   ├── Gemini + Xevyo (AI)                   ← Nea SI chat, Skin Lens
   ├── Open Beauty Facts, Open-Meteo         ← fixed hosts only (Routine Builder, skin forecast)
   └── Jane (booking)                        ← links out only; no login sharing
```

- **Hosting:** NEA's DevOps person, on NEA's own server and domain, in **Canada**. Vercel is only a temporary showcase and will be deleted.
- **One app, one database.** Add more app servers later behind a load balancer. The database stays one.

## 2. Code layout

```
src/
  app/                 pages (server-rendered) + api/ routes
    (public pages)     /, /treatments, /programs, …
    account/           sign-in, sign-up, settings (new)
    staff-portal/      admin pages, reached only through the secret ADMIN_PATH (middleware rewrite)
    api/               all server endpoints
  components/          UI, grouped by feature
  content/             ALL copy and data (edit text here)
  lib/
    server/            server-only code (new): db, auth, email, audit, rate-limit, captcha
    …                  shared helpers
middleware.ts          admin path rewrite + 404 guard, noindex on private pages
db/
  migrations/          SQL migrations incl. RLS policies and nea_maintenance()
  migrate.mjs          migration runner
deploy/                nginx.conf, PM2 ecosystem
tests/                 security.py, e2e.py, links.py, load.mjs
docs/                  these docs
```

- Files in `src/lib/server/` start with `import "server-only"`, so a bad import fails the build instead of leaking to the browser.

## 3. Database (PostgreSQL)

- **Access:**
  - `node-postgres` (`pg`) through `src/lib/server/db.ts`.
  - Every query uses `$1, $2…` parameters. No ORM, no string-built SQL.
  - `asUser()`, `asStaff()`, `asSystem()` and `asAnon()` wrap each request in a transaction that sets `app.user_id` and `app.role`.
- **Migrations:** plain SQL files in `db/migrations/`, applied in order by `npm run db:migrate` (tracked in `schema_migrations`).
- **IDs:** random UUIDs. Nothing guessable.

### Tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | id, email (unique, lowercased), name, birth_ym, role (`member`/`staff`/`admin`), status (`active`/`pending_parent`/`deleted`), created_at | |
| `auth_identities` | user_id, provider (`email`/`google`/`apple`), provider_sub | One user, many sign-in methods |
| `login_codes` | email, code_hash, expires_at, attempts, ip | Hashed code, 10 min, 5 tries |
| `sessions` | id, user_id, token_hash, expires_at, ip, user_agent, mfa_ok | Cookie holds the token; DB holds only its hash |
| `parent_consents` | child_user_id, parent_email, token_hash, consented_at | Under-18 flow |
| `consents` | user_id, kind (`privacy`/`marketing`), version, given_at, withdrawn_at | Proof of consent |
| `scans` | id, user_id, taken_at, score, bpm, stress, water, redness, shine, tone, smooth, eyes, source (`live`/`lens`) | **Numbers only** |
| `diary_entries` | user_id, date, note, scan_id | |
| `routines`, `plans`, `events_countdown` | user_id, data (jsonb), updated_at | |
| `points_ledger` | user_id, delta, reason, by_staff_id, created_at | Points are a sum, never edited in place |
| `activity_events` | id, user_id (nullable), anon_id, session_id, name, path, props (jsonb), utm, created_at | **Partitioned by month** |
| `leads` | id, kind, name, email, phone, message, created_at | Form submissions |
| `staff_mfa` | user_id, totp_secret (encrypted), backup_codes_hash | Staff only |
| `audit_log` | id, staff_id, action, target, before, after, ip, created_at | **Insert-only** |
| `glow_docs` | user_id, kind (`routine`/`event`/`plan`), data | One document each, size-capped |
| `redemptions` | user_id, reward, pts, code, used_at | Front desk marks them used |
| `activity_daily` | day, name, events, visitors | Kept after raw events are dropped |
| `rate_limits` | key, count, reset_at | UNLOGGED table shared by every app server (no Redis needed) |

### Indexes
- `users(email)` unique
- `sessions(token_hash)` unique
- `sessions(user_id)`
- `scans(user_id, taken_at desc)`
- `points_ledger(user_id)`
- `activity_events(created_at)`, `(name, created_at)`, `(user_id, created_at)`, each per partition
- `leads(created_at)`
- `audit_log(created_at)`

### Row Level Security (RLS)
- RLS is **on** for every table that holds user data.
- The app connects as role `nea_app`. That role does not own the tables and has no `BYPASSRLS`.
- Each request runs in a transaction that starts with `SET LOCAL app.user_id = '<id from session>'` and `SET LOCAL app.role = 'member'|'staff'|'admin'`.
- **Member policy:** `user_id = current_setting('app.user_id')::uuid`.
- **Staff policy:** read all rows when `app.role` is staff or admin. Write only through admin actions, which are audited.
- **Tables with special rules:**
  - `audit_log`: insert-only. No update or delete grant for anyone except the owner role.
  - `activity_events`: insert for everyone; select for staff only.
- **Why RLS when the app already checks?** RLS is the second lock. A missed `where user_id = …` in app code still can't leak another user's data.

### Activity data at scale
- **Expected volume:** 10k users × 50 events a month = 500k rows a month, which is easy. 10M rows a month is still fine with monthly partitions.
- Older partitions get rolled up into daily summary tables, and raw events are dropped after 25 months.
- If it ever grows past roughly 100M rows a month, copy events to ClickHouse for analytics. Postgres stays the source of truth.

## 4. Authentication (built in-house)

- **Email code:**
  1. The user enters their email.
  2. The server makes a 6-digit code and stores `HMAC-SHA256(code, AUTH_PEPPER)`.
  3. It emails the code.
  4. 10-minute expiry. Max 5 tries. Rate-limited per email and per IP.
- **Google / Apple:**
  - OIDC authorization-code flow with PKCE, `state` and `nonce`.
  - The ID token is verified against the provider's JWKS (issuer, audience, expiry).
  - Small libraries: `arctic` for the flow, `jose` for the token checks.
- **Sessions:**
  - 32 random bytes in a cookie: `__Host-nea_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
  - The DB stores only the SHA-256 hash.
  - 30-day sliding expiry.
  - A new token on every sign-in, and on every role or MFA change.
- **No JWTs and nothing secret in localStorage.** If a JWT is ever needed, for example for a webhook, its secret lives only in the server environment.
- **Staff MFA:**
  - TOTP (authenticator app) is required before any staff page loads, plus 10 one-time backup codes, stored hashed.
  - Passkeys can come later.
- **Passwords:** there are none. If staff passwords are ever added, hash them with **argon2id**.
- **Permissions:** one server helper does the check, for example `requireUser()`, `requireStaff()`, `requireAdmin()`. It runs at the top of every API route and server action. The UI hiding a button is never the security.

## 5. Request security (every API route)

| Check | How |
| --- | --- |
| Auth | `requireUser/Staff/Admin` first line (public routes are listed and reviewed) |
| Input | `zod` schema on every body, query and param. Unknown keys rejected. Strings trimmed and length-capped |
| Owner check (IDOR) | Never take `user_id` from the client. Always from the session. Any object id is looked up **with** the session user (and RLS) |
| CSRF | `SameSite=Lax` cookie + `Origin`/`Host` check on POST, PUT, PATCH, DELETE. Server actions check origin too |
| Rate limit | Per IP (from `X-Real-IP`, set by Nginx) + per email for sign-in codes. Stored in the Postgres `rate_limits` table, so every server shares it. Falls back to memory if the database is down |
| Captcha | **ALTCHA** (open-source, self-hosted proof-of-work, no third party) on sign-up, sign-in, lead forms and parent consent, plus a honeypot field |
| CORS | Same-origin only. API routes send no `Access-Control-Allow-Origin` |
| Output | JSON only. Never return stack traces. Errors are generic, details go to server logs |
| SSRF | Server `fetch` only to a fixed allowlist: Gemini, Xevyo, Open Beauty Facts, Open-Meteo, email API, Google and Apple OIDC, Instagram. Users can never supply a URL to fetch |
| Uploads | Skin Lens photo: check JPEG, PNG or WebP by **magic bytes**, not just the label. Max 2 MB. Analysed in memory, never saved |
| Webhooks | Outgoing lead webhook signed with `HMAC-SHA256` (`X-NEA-Signature`). Incoming webhooks (email provider, future) verified the same way, with a timestamp and 5-minute replay window |

## 6. Security headers (`next.config.mjs`)

- **Content-Security-Policy:**
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net`. Next.js needs its small inline scripts. A nonce would force every page to render per request and lose the page caching, so we chose caching and lock everything else down.
  - `img-src 'self' data: blob:` plus the allowed image hosts
  - `connect-src 'self'` plus the MediaPipe CDN
  - `frame-src` for Instagram, YouTube and TikTok embeds
  - `frame-ancestors 'none'`
  - `form-action 'self'`
  - `base-uri 'self'`
- **Already set:** `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `HSTS`, `Permissions-Policy` (camera self only), `poweredByHeader: false`.
- **JSON-LD:** escape `<` as `<` before inserting, so page data can't close the script tag.

## 7. Admin page

- Lives at a **random path** set in the env (`ADMIN_PATH`, for example `/staff-7f3k…`). It's not in the sitemap and it carries a `noindex` header. The internal folder `/staff-portal` always answers 404 when opened directly.
- The page layout returns **404** (not 403) unless there's a staff session. Staff without two-step sign-in see only the MFA screen, and every staff API answers 404 without `mfa_ok`. The session token is replaced after two-step sign-in.
- Every staff write goes through one `audit()` helper.

## 8. Caching and performance

- **Public pages:** server-rendered, and static or ISR where content doesn't change (treatments, programs, blog). `revalidate` is 1 hour, or on publish.
- **Logged-in pages:** dynamic, `Cache-Control: private, no-store`.
- **API:** `no-store` by default. Only safe public data is cached (skin forecast 30 min, product lookups 1 day).
- **Static files:** `_next/static`, `/media` and the fonts are cached for 1 year, `immutable`.
- **Images:** `next/image` (AVIF and WebP). Old WordPress images get moved into `/public/media` before the domain switch.
- **DB:** connection pool (`max` about 10 per app instance). Indexes as listed above. `EXPLAIN` any query over 50 ms.

## 9. Analytics (first-party)

- A small client helper, `track(name, props)`, batches events every 5 s, plus one final send when the page closes.
- They go to `POST /api/events`, which is rate-limited and size-capped.
- A random `anon_id` lives in a first-party cookie. It's linked to `user_id` at sign-up.
- Respects the cookie-consent choice and Do Not Track. No third-party trackers by default.
- Search Console and Bing are verified by DNS (no script).

## 10. Environments and secrets

- Secrets live in `.env.local` (dev) and the server's environment (prod). **Never `NEXT_PUBLIC_`.**
- **New secrets:**
  - `DATABASE_URL`
  - `AUTH_PEPPER`
  - `SESSION_SECRET`
  - `GOOGLE_CLIENT_ID/SECRET`
  - `APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY`
  - `EMAIL_*`
  - `ALTCHA_HMAC_KEY`
  - `LEAD_WEBHOOK_SECRET`
  - `ADMIN_PATH`
  - `DATA_ENC_KEY` (encrypts TOTP secrets)
- **Prod settings:**
  - `NODE_ENV=production`, so there's no debug output or dev overlay
  - source maps are not served
  - the DB user has no superuser rights

## 11. Deployment and scaling (for DevOps)

1. Node 20 LTS, `npm ci && npm run build && npm start` behind Nginx or Caddy with HTTPS.
2. PostgreSQL 16 in Canada, with daily backups kept for 30 days, a tested restore, and encryption at rest.
3. Run migrations before each release (`npm run db:migrate`).
4. To scale: more app instances behind the load balancer. This needs Redis or the Postgres rate limiter, since the in-memory one only counts per instance. Sessions are already in the DB.
5. **Load test** with k6 before launch:
   - 200 concurrent users on public pages
   - 50 on sign-in
   - 20 on Nea SI
   - p95 under 800 ms for pages and under 300 ms for API routes without AI
6. **Logs:** JSON to stdout, with no emails, codes or tokens in them.
7. **Uptime check:** `/api/health`.
