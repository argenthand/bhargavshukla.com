#!/usr/bin/env bash
# CMS backups to the R2 `cms-backups` bucket (#14); see docs/infrastructure.md → Backups.
# Runs on the VPS as deploy, from /etc/cron.d/cms-backup:
#   backup.sh nightly   SQLite online backup of data.db → nightly/data-<stamp>.db.gz
#   backup.sh weekly    strapi export (content and config) → weekly/export-<stamp>.tar.gz
# For restores (by hand):
#   backup.sh list                 what's in the bucket
#   backup.sh fetch <key>          download one object into /opt/cms/restore/
# Retention is an R2 lifecycle rule per prefix, not this script.
set -euo pipefail

cd /opt/cms
# R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY for the backups-only token
set -a
. ./backup.env
set +a

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
# The token can't create buckets, so don't let rclone try.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

stamp=$(date -u +%Y-%m-%dT%H%MZ)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

case "${1:-}" in
  nightly)
    # .backup is safe while Strapi is writing; a plain cp of the file is not.
    sqlite3 data/data.db ".backup '$tmp/data.db'"
    check=$(sqlite3 "$tmp/data.db" 'PRAGMA integrity_check')
    [ "$check" = ok ] || { echo "integrity check failed: $check" >&2; exit 1; }
    gzip "$tmp/data.db"
    rclone copyto "$tmp/data.db.gz" "r2:cms-backups/nightly/data-$stamp.db.gz"
    ;;
  weekly)
    file="/tmp/export-$stamp"
    docker compose exec -T strapi npx strapi export --no-encrypt -f "$file" >/dev/null
    docker compose cp "strapi:$file.tar.gz" "$tmp/"
    docker compose exec -T strapi rm -f "$file.tar.gz"
    rclone copyto "$tmp/export-$stamp.tar.gz" "r2:cms-backups/weekly/export-$stamp.tar.gz"
    ;;
  list)
    rclone ls r2:cms-backups
    exit
    ;;
  fetch)
    key=${2:?usage: $0 fetch <key>}
    mkdir -p restore
    rclone copyto "r2:cms-backups/$key" "restore/$(basename "$key")"
    echo "restore/$(basename "$key")"
    exit
    ;;
  *)
    echo "usage: $0 nightly|weekly|list|fetch <key>" >&2
    exit 2
    ;;
esac

echo "$1 backup uploaded ($stamp)"
