#!/usr/bin/env bash
# Nightly logical backup of the whole database (public data + auth users +
# pg-boss queue). Keeps the last $KEEP_DAYS days of dumps.
#
#   crontab -e
#   15 3 * * * /opt/grantpilot/deploy/backup.sh >> /var/log/grantpilot-backup.log 2>&1
#
# Restore: see DEPLOY.md "Backups".
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/grantpilot}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$BACKUP_DIR/grantpilot-$stamp.dump"

# Custom format (-Fc): compressed, restorable selectively with pg_restore.
# Runs as supabase_admin (the image's superuser) so auth.* is included.
docker compose exec -T db pg_dump -U supabase_admin -d postgres -Fc \
  --schema=public --schema=auth --schema=_grantpilot --schema=pgboss > "$out.tmp"
mv "$out.tmp" "$out"
echo "$(date -u +%FT%TZ) backup ok: $out ($(du -h "$out" | cut -f1))"

find "$BACKUP_DIR" -name 'grantpilot-*.dump' -mtime +"$KEEP_DAYS" -delete
