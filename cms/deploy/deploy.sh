#!/usr/bin/env bash
# Deploys one CMS commit on the VPS (#48); see docs/infrastructure.md → Automated CMS deploys.
#
# Run by GitHub Actions over SSH with a key that can only run this script (a `command=` line in
# ~deploy/.ssh/authorized_keys), so the commit SHA arrives in SSH_ORIGINAL_COMMAND. By hand:
#   /opt/cms/deploy.sh <full commit sha>     deploy (or roll back to) that commit
#
# 1. Backup first (a restore point before any schema change).
# 2. Sync the compose file, backup script and cron file from the repo at that commit.
# 3. Pin CMS_TAG=<sha> in .env, pull, restart.
# 4. Wait for Strapi to be healthy on that revision; if it isn't, go back to the previous tag.
set -euo pipefail

sha=${1:-${SSH_ORIGINAL_COMMAND:-}}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: deploy.sh <40-character commit sha>" >&2
  exit 2
fi

cd /opt/cms
exec 9>/opt/cms/.deploy.lock
flock -n 9 || { echo "another deploy is running" >&2; exit 1; }

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }
raw="https://raw.githubusercontent.com/argenthand/bhargavshukla.com/$sha/cms/deploy"

current_tag() { grep -E '^CMS_TAG=' .env | tail -1 | cut -d= -f2 || true; }
set_tag() {
  sed -i '/^CMS_TAG=/d' .env
  echo "CMS_TAG=$1" >> .env
}
wait_healthy() { # $1 = expected revision; fails after ~4 minutes
  local id status rev
  for _ in $(seq 1 48); do
    id=$(docker compose ps -q strapi)
    status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)
    rev=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$id" 2>/dev/null || true)
    if [[ $status == healthy && $rev == "$1" ]]; then return 0; fi
    sleep 5
  done
  return 1
}

# Roll back to what's actually running, not to `latest` (CI has already moved `latest` to $sha).
previous=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
  "$(docker compose ps -q strapi)" 2>/dev/null || current_tag)
log "deploying $sha (running: ${previous:-unknown})"

log "backup"
./backup.sh nightly

log "syncing deploy files from the repo"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fetch() { # a file missing at that commit (older than #48) keeps the current copy
  curl -fsSL --retry 3 "$raw/$1" -o "$tmp/$1" 2>/dev/null || { log "  $1: not at $sha, keeping the current one"; return 1; }
}
fetch docker-compose.yml && install -m 644 "$tmp/docker-compose.yml" docker-compose.yml
fetch backup.sh && install -m 755 "$tmp/backup.sh" backup.sh
fetch cms-backup.cron && sudo install -m 644 -o root -g root "$tmp/cms-backup.cron" /etc/cron.d/cms-backup
# Replaced last: bash has already read this script, and mv gives the new one its own inode.
fetch deploy.sh && install -m 755 "$tmp/deploy.sh" deploy.sh.new && mv deploy.sh.new deploy.sh

set_tag "$sha"
log "pull and restart"
docker compose pull -q strapi
docker compose up -d --remove-orphans

if wait_healthy "$sha"; then
  log "healthy on $sha"
  docker image prune -f --filter "until=168h" >/dev/null
  exit 0
fi

log "NOT healthy on $sha"
docker compose logs strapi --since 10m --tail 50 >&2 || true
if [[ $previous =~ ^[0-9a-f]{40}$ ]]; then
  log "rolling back to $previous"
  set_tag "$previous"
  docker compose pull -q strapi
  docker compose up -d
  wait_healthy "$previous" && log "back on $previous" || log "rollback is not healthy either: check by hand"
else
  log "no previous revision to roll back to: check by hand"
fi
exit 1
