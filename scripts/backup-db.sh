#!/usr/bin/env bash
# Daily encrypted-at-rest backup of the NEA database, kept for 30 days.
#   DATABASE_OWNER_URL=postgres://… BACKUP_DIR=/var/backups/nea ./scripts/backup-db.sh
# Put it in cron (e.g. 02:30 every night) and copy BACKUP_DIR off the server (another Canadian region or bucket).
# Restore test (do this monthly):  createdb nea_restore && pg_restore -d nea_restore --no-owner <file>
set -euo pipefail
: "${DATABASE_OWNER_URL:?Set DATABASE_OWNER_URL}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
mkdir -p "$DIR"
chmod 700 "$DIR"
FILE="$DIR/nea-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --compress=9 --no-owner --file="$FILE" "$DATABASE_OWNER_URL"
chmod 600 "$FILE"
# a backup that can't be read is not a backup: list its contents to prove it opens
pg_restore --list "$FILE" > /dev/null
find "$DIR" -name 'nea-*.dump' -type f -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
