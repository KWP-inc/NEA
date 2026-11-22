# Deploying NEA Precision Skin (for DevOps)

Everything needed to run the site on NEA's own server, in Canada. Read top to bottom once.

## 1. What runs

| Part | What | Notes |
| --- | --- | --- |
| App | Next.js 15 on **Node 20 LTS** (`npm start`) | 1 process per CPU core (PM2 config in `deploy/ecosystem.config.cjs`) |
| Database | **PostgreSQL 16** | In a Canadian region. Encrypted at rest, daily backups |
| Web server | **Nginx** (`deploy/nginx.conf`) | HTTPS, caching of public pages, sets the real visitor IP |
| Email | NEA's SMTP server | Sign-in codes, parent consent, staff invites |
| Cron | 3 small jobs | Maintenance (daily), backups (daily), Instagram token (weekly) |

The site does **not** need Vercel. It is a normal Node server.

## 2. One-time setup

### 2.1 Database
1. Create PostgreSQL 16 in Canada (managed: AWS `ca-central-1`, Azure Canada Central, DigitalOcean Toronto; or your own server).
2. Create the owner role and the database (as a superuser):
   ```sql
   CREATE ROLE nea_owner LOGIN PASSWORD '<strong password>' CREATEROLE;
   CREATE DATABASE nea OWNER nea_owner;
   \c nea
   ALTER SCHEMA public OWNER TO nea_owner;
   ```
3. Turn on SSL to the database and allow connections only from the app server.

### 2.2 Server settings
1. Copy `.env.example` to the server's environment (or `/srv/nea/.env.local`, permissions `600`, owned by the app user).
2. Fill every value. Make each secret with `openssl rand -base64 32`, a different one for each.
   - `DATABASE_URL` uses role **nea_app** (the migration creates it; give it a password with `NEA_APP_PASSWORD`, see the next step).
   - `DATABASE_OWNER_URL` uses **nea_owner** (only for migrations, backups and creating the first admin).
   - `ADMIN_PATH`: make one with `echo staff-$(openssl rand -hex 6)`. Give it only to the owner.
   - `NEXT_PUBLIC_SITE_URL=https://neaprecisionskin.com`. This must be set **before** `npm run build`.
3. Never put secrets in Git. Never add a variable starting with `NEXT_PUBLIC_` for a secret.

### 2.3 Install, migrate, build
```bash
cd /srv/nea
npm ci
NEA_APP_PASSWORD='<password for nea_app>' npm run db:migrate   # creates tables, security rules, the nea_app role
npm run build
npm run admin:create -- owner@neaskincare.com "Owner name"     # first admin
```

### 2.4 Run the app (PM2)
```bash
npm i -g pm2
pm2 start deploy/ecosystem.config.cjs     # starts one process per core on ports 3000, 3001, …
pm2 save && pm2 startup                   # restart on reboot
```
Make the ports in `deploy/nginx.conf` → `upstream nea_app` match the number of processes.

### 2.5 Nginx + HTTPS
1. `certbot --nginx -d neaprecisionskin.com -d www.neaprecisionskin.com`
2. Copy `deploy/nginx.conf` to `/etc/nginx/conf.d/nea.conf`, then `nginx -t && systemctl reload nginx`.
3. **Important:** Nginx must set `X-Real-IP $remote_addr` (it's in the file). The app's rate limits use it. The PM2 config makes the app listen on `127.0.0.1` only, so nobody can reach it around Nginx and fake that header. Keep it that way.

### 2.6 Cron jobs (`crontab -e` as the app user)
```cron
# daily housekeeping: partitions, daily totals, delete expired codes/sessions, delete unconsented child accounts
15 3 * * *  cd /srv/nea && bash -c 'set -a; . ./.env.local; set +a; npm run -s db:maintain' >> /var/log/nea-maintain.log 2>&1
# daily database backup, kept 30 days (copy BACKUP_DIR to another Canadian location too)
30 2 * * *  cd /srv/nea && bash -c 'set -a; . ./.env.local; set +a; BACKUP_DIR=/var/backups/nea bash scripts/backup-db.sh' >> /var/log/nea-backup.log 2>&1
# weekly Instagram token refresh (only if INSTAGRAM_ACCESS_TOKEN is used)
17 9 * * 1  cd /srv/nea && bash -c 'set -a; . ./.env.local; set +a; curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://neaprecisionskin.com/api/instagram/refresh' > /dev/null
```
Test a restore once a month: `createdb nea_restore && pg_restore -d nea_restore --no-owner /var/backups/nea/<file>.dump`.

### 2.7 Email
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
- Add **SPF, DKIM and DMARC** DNS records for the sending domain. Without them, sign-in codes land in spam.

### 2.8 Google / Apple sign-in (optional; the buttons appear only when set)
- **Google:** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
  - Authorized redirect URI: `https://neaprecisionskin.com/api/auth/google/callback`.
- **Apple:** Apple Developer → Identifiers → Services ID (Sign in with Apple) + Keys.
  - Return URL: `https://neaprecisionskin.com/api/auth/apple/callback`.
  - Put the `.p8` key in `APPLE_PRIVATE_KEY`, on one line with `\n`.

### 2.9 Search engines
1. **Google Search Console:** add the domain property, verify with the **DNS TXT** record, then submit `https://neaprecisionskin.com/sitemap.xml`. (You can use the HTML tag instead: `GOOGLE_SITE_VERIFICATION`.)
2. **Bing Webmaster Tools:** import from Search Console, or verify with `BING_SITE_VERIFICATION`, then submit the sitemap.
3. **IndexNow:** set `INDEXNOW_KEY`, then after each release run `SITE_URL=https://neaprecisionskin.com npm run seo:indexnow`.

### 2.10 Instagram feed that updates itself (optional)
Without this, the Glow Feed shows the videos listed in `src/content/reels.ts`. With it, NEA's newest posts and Reels appear by themselves (checked every hour).
1. developers.facebook.com → **Create app** → type **Business** → add the product **Instagram** → "API setup with Instagram login".
2. Add `@neaprecisionskin` (a Business or Creator account) and **Generate token**.
3. Put it in `.env.local` as `INSTAGRAM_ACCESS_TOKEN=...`, then `pm2 reload all`.
4. The weekly cron job in §2.6 keeps the token alive (tokens last 60 days).

### 2.11 Shop link and newsletters
- **Shop:** set `NEXT_PUBLIC_SHOP_URL=https://<NEA's Shopify store>` and rebuild. A "Shop online" link then shows in the footer, the More menu and the skincare pages. Empty = hidden.
- **Newsletters:** put the PDF in `public/newsletters/` (e.g. `2026-11.pdf`, optional cover `2026-11.jpg`) and fill `file` in `src/content/newsletters.ts`. Issues without a file stay hidden.

### 2.12 Testing accounts on your own computer
`npm start` is production mode, so without an email server the sign-in page says "Accounts open soon".
On localhost it also lists exactly what's missing. To test without email, add `EMAIL_TO_CONSOLE=1` to `.env.local`
and restart: the 6-digit code is printed in the terminal. **Never set it on the real server.**

### 2.13 The Vercel preview (showcase only)
The Vercel copy has no database or email, so:
- the sign-in page says **"Accounts open soon"** (no errors), and
- Skin Diary, Routine and the other My Glow tools work and save **on that device only**.
To try real accounts there, add `DATABASE_URL`, `DATABASE_OWNER_URL`, `AUTH_PEPPER`, `SESSION_SECRET`, `ALTCHA_HMAC_KEY` and the `SMTP_*` settings in Vercel → Settings → Environment Variables, run `npm run db:migrate` against that database once, and redeploy. The real launch uses NEA's own server (this guide), not Vercel.

## 3. Before the domain moves off WordPress (must do)
1. On any computer with internet: `npm run media:migrate`. This copies NEA's photos from WordPress into `public/media/wp`.
2. Commit `public/media/wp` and `src/content/generated/wp-local.json`, then rebuild.
3. Check the old WordPress URLs redirect (they are in `next.config.mjs`). The free-scan poster QR code points to `/free-scan`, which must stay live forever.

## 4. Every release
One command does everything below and then checks the live site really shows the new version
(it fails loudly if an old cached page is still being served):
```bash
cd /srv/nea && bash deploy/release.sh
```
The same steps by hand:
```bash
cd /srv/nea && git pull
npm ci
npm run db:migrate          # safe to run every time; applies only new migrations
npm run build
pm2 reload all              # zero-downtime restart
rm -rf /var/cache/nginx/nea/* && systemctl reload nginx   # clear cached pages
```

## 5. Health and logs
- Uptime check: `GET https://neaprecisionskin.com/api/health` → `{"ok":true,"db":"ok"}` (503 if the database is down).
- Logs are JSON lines on stdout (`pm2 logs`). They never contain codes, tokens or passwords.
- Slow queries (over `DB_SLOW_MS`, default 50 ms) are logged as `"slow query"`.

## 6. Scaling
- **More traffic:** add Node processes (and lines in `upstream nea_app`), or add app servers behind the same Nginx.
  - Sessions and rate limits live in Postgres, so any server can answer any visitor.
- **Database:** raise `DB_POOL_MAX` per process. Keep `processes × DB_POOL_MAX` under Postgres `max_connections` (or put PgBouncer in front).
- **Load test results:** see `docs/Testing.md`. One process on 2 CPU cores, behind Nginx, served 1,300–4,900 pages a second at 200 users at once.

## 7. Security checklist for the server
- [ ] Only ports 80/443 (and SSH from known IPs) open. Postgres not open to the internet.
- [ ] App runs as its own user, not root. `.env.local` is `chmod 600`.
- [ ] `NODE_ENV=production` (PM2 config sets it).
- [ ] OS security updates on (unattended-upgrades).
- [ ] Backups copied off the server and a restore tested.
- [ ] `ADMIN_PATH` known only to the owner. Every staff member sets up two-step sign-in on first login.
