#!/usr/bin/env bash
# One-command release for the NEA server (run as the app user from the app folder, e.g. /srv/nea).
#   bash deploy/release.sh
# Steps: pull → install → migrate → build → zero-downtime restart → clear the Nginx page cache → check
# that the live site really serves the new build (an old cached page once showed the old phone number).
set -euo pipefail
SITE="${SITE_URL:-https://neaprecisionskin.com}"
CACHE_DIR="${NGINX_CACHE_DIR:-/var/cache/nginx/nea}"

echo "1/7 git pull";            git pull --ff-only
echo "2/7 npm ci";              npm ci
echo "3/7 database migrations"; npm run db:migrate
echo "4/7 build";               npm run build
BUILD_ID="$(cat .next/BUILD_ID)"
echo "5/7 restart app (no downtime)"; pm2 reload all
echo "6/7 clear the Nginx page cache"
sudo find "$CACHE_DIR" -mindepth 1 -delete
sudo systemctl reload nginx
echo "7/7 check the live site serves build $BUILD_ID"
sleep 3
for i in 1 2 3 4 5; do
  if curl -fsS "$SITE/" | head -c 400 | grep -q "$BUILD_ID"; then
    echo "OK: live site is on build $BUILD_ID"
    [ -n "${INDEXNOW_KEY:-}" ] && SITE_URL="$SITE" npm run seo:indexnow || true
    exit 0
  fi
  sleep 3
done
echo "PROBLEM: the live home page is not on build $BUILD_ID. Check: pm2 logs, then clear $CACHE_DIR again." >&2
exit 1
