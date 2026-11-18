#!/usr/bin/env bash
# DATA-LOSING: replaces the live production database with a dump from deploy/backups.
# Every write since that dump is lost. Run only from the 6. Rollback workflow.
#   db-restore.sh <dump file name>    host side: checks, safety backup, stop api, restore, health
#   db-restore.sh --apply <dump>      in the client container: pg_restore over PGDATABASE
set -euo pipefail

if [[ ${1:-} == --apply ]]; then
  dump=$2
  : "${PGDATABASE:?Set PGDATABASE}"
  (cd "$(dirname "$dump")" && sha256sum --check --status "$(basename "$dump").sha256") ||
    { echo "Checksum mismatch: $dump" >&2; exit 1; }
  # One transaction: a failed restore leaves the live database as it was.
  pg_restore --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error \
    --dbname="$PGDATABASE" "$dump"
  echo "Restored $(basename "$dump") into $PGDATABASE" >&2
  exit
fi

if [[ $# -ne 1 || ! $1 =~ ^[0-9]{8}T[0-9]{6}Z-[0-9A-Za-z]{1,40}\.dump$ ]]; then
  echo "Usage: $0 <YYYYMMDDTHHMMSSZ-sha.dump>" >&2
  exit 2
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"
export BACKUP_DIR=${BACKUP_DIR:-$ROOT_DIR/deploy/backups}
dump="$BACKUP_DIR/$1"
[[ -f $dump ]] || { echo "No such dump: $1" >&2; exit 1; }
# shellcheck source=scripts/db-docker.sh
source "$ROOT_DIR/scripts/db-docker.sh"

exec 9>"$ROOT_DIR/deploy/.deploy.lock"
flock -n 9 || { echo "A deployment is running" >&2; exit 1; }

active=$(<"$ROOT_DIR/deploy/.active-color")
[[ $active == blue || $active == green ]] || { echo "Invalid active color: $active" >&2; exit 1; }
api="planner-$active-api"

bash scripts/db-restore-check.sh --docker "$dump"
safety=$(BACKUP_SHA=prerestore bash scripts/db-backup.sh --docker)
echo "Safety backup before restore: $safety" >&2

# shellcheck disable=SC2329 # invoked by the EXIT trap
restart_api() {
  local status=$?
  trap - EXIT
  docker start "$api" > /dev/null || true
  if (( status != 0 )); then
    echo "Restore failed; live data unchanged unless pg_restore committed. Safety backup: $safety" >&2
  fi
  exit "$status"
}
trap restart_api EXIT

docker stop -t 15 "$api"
db_in_docker db-restore.sh --apply "$dump"
docker start "$api" > /dev/null
for _ in $(seq 1 30); do
  if docker exec "$api" wget -qO- http://127.0.0.1:4000/api/v1/health > /dev/null 2>&1; then
    echo "Database restored from $1; API healthy" >&2
    exit 0
  fi
  sleep 5
done
echo "API did not become healthy after restore" >&2
exit 1
