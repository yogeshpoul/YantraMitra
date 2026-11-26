#!/bin/sh
# Daily logical backup with retention. Run from cron on a host that can reach the database:
#   0 2 * * *  DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/yantramitra /opt/yantramitra/backup.sh
# Restore: pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>.dump
# Copy the files off the server (object storage or another machine); a backup on the same disk is not a backup.
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/yantramitra-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --file="$file.partial" "$DATABASE_URL"
mv "$file.partial" "$file"
# Verify the archive is readable before pruning older ones.
pg_restore --list "$file" > /dev/null
find "$BACKUP_DIR" -name 'yantramitra-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $file"
