# Tests

Run them against a **production build** (`npm run build && npm start`) with a database and an email catcher.
All reports go to `tests/out/`.

## Setup (once)
```bash
pip install playwright aiosmtpd          # browser tests use Chrome (CHROME=/usr/bin/google-chrome) or: playwright install chromium
npm run db:migrate                        # local Postgres (docker compose up -d works)
# catch emails locally, so the tests can read sign-in codes (keep it running in its own terminal):
python3 tests/smtp_catch.py /tmp/mail
```
In `.env.local` set `SMTP_HOST=127.0.0.1`, `SMTP_PORT=2525` and `CLUB_CODES="GLOW50=50=Clinic visit"`.

## Run
```bash
set -a; . ./.env.local; set +a            # gives the tests ADMIN_PATH and DATABASE_OWNER_URL
export BASE=http://localhost:3000 MAIL_DIR=/tmp/mail

npm run test:security   # 79 API and security checks: sign-up, ages, points, IDOR, CSRF, SQLi, XSS, rate limits, captcha, MFA, uploads, delete
npm run test:links      # crawls every page: broken links, missing files, title/description/h1/og:image/canonical/JSON-LD, old URL redirects
npm run test:e2e        # Chrome, phone + desktop: every key page, tabs, console and CSP errors, cookie banner, sign-up, staff page
npm run test:load       # autocannon: 200 users at once on pages, 100 on APIs
```

## Live face scan with a fake camera
Chrome's built-in fake camera has no face, so the scan correctly waits. To test a full scan, make a face video
with a simulated pulse and pass it in:
```bash
FAKE_CAMERA_Y4M=/path/face.y4m npm run test:e2e
```
The video is a `.y4m` made from a face photo, with a small colour change on skin pixels at 72 bpm
(G about 1 level, R 0.45, B 0.3). The test checks that the scan reads 72 bpm ± 6.

If tests are re-run quickly, clear the shared rate limits first: `psql "$DATABASE_OWNER_URL" -c "truncate rate_limits"`.
