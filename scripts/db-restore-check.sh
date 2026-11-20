#!/usr/bin/env bash
# Proves a dump restores: verifies its sha256, restores it into the scratch database
# RESTORE_DB (default planner_restore_check) on the same server, compares the latest
# migration and users/tasks/collections counts with the .json sidecar, then drops it.
#   db-restore-check.sh <dump>
#   db-restore-check.sh --docker <dump>   against the prod postgres container
set -euo pipefail

if [[ ${1:-} == --docker ]]; then
  # shellcheck source=scripts/db-docker.sh
  source "$(dirname "${BASH_SOURCE[0]}")/db-docker.sh"
  db_in_docker db-restore-check.sh "${@:2}"
  exit
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 [--docker] <dump>" >&2
  exit 2
fi
dump=$1
RESTORE_DB=${RESTORE_DB:-planner_restore_check}
: "${PGDATABASE:?Set PGDATABASE}"

if [[ ! $RESTORE_DB =~ ^[a-z_][a-z0-9_]*$ || ${#RESTORE_DB} -gt 45 ]]; then
  echo "RESTORE_DB must be a lowercase identifier of at most 45 characters" >&2
  exit 2
fi
if [[ $RESTORE_DB == "$PGDATABASE" ]]; then
  echo "Refusing to restore over the live database $PGDATABASE" >&2
  exit 2
fi
for file in "$dump" "$dump.sha256" "$dump.json"; do
  [[ -f $file ]] || { echo "Missing $file" >&2; exit 1; }
done

if ! (cd "$(dirname "$dump")" && sha256sum -c "$(basename "$dump").sha256" > /dev/null 2>&1); then
  echo "Checksum mismatch: $dump" >&2
  exit 1
fi

json=$(<"$dump.json")
field() { sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p" <<< "$json"; }

# --maintenance-db keeps database creation and removal off live connections.
scratch() { "$1" --maintenance-db=postgres "${@:2}"; }
scratch_db="${RESTORE_DB}_$(printf '%04x%04x%04x%04x' "$RANDOM" "$RANDOM" "$RANDOM" "$RANDOM")"
created=false
cleanup() {
  local status=$?
  trap - EXIT
  if [[ $created == true ]] && ! scratch dropdb "$scratch_db"; then
    echo "Could not drop $scratch_db" >&2
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT

scratch createdb "$scratch_db"
created=true
pg_restore --exit-on-error --no-owner --no-acl --dbname="$scratch_db" "$dump"

actual=$(psql -X -A -t -v ON_ERROR_STOP=1 --dbname="$scratch_db" -c "SELECT concat_ws('|',
  (SELECT max(filename) FROM schema_migrations), (SELECT count(*) FROM users),
  (SELECT count(*) FROM tasks), (SELECT count(*) FROM collections));")
expected="$(field migration)|$(field users)|$(field tasks)|$(field collections)"
if [[ $actual != "$expected" ]]; then
  echo "Restore check failed: restored '$actual', dump recorded '$expected'" >&2
  exit 1
fi
echo "Restore check passed: $(basename "$dump") (migration|users|tasks|collections = $actual)" >&2
