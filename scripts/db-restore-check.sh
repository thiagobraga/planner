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

if [[ ! $RESTORE_DB =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "RESTORE_DB must be a plain lowercase identifier" >&2
  exit 2
fi
if [[ $RESTORE_DB == "$PGDATABASE" ]]; then
  echo "Refusing to restore over the live database $PGDATABASE" >&2
  exit 2
fi
for file in "$dump" "$dump.sha256" "$dump.json"; do
  [[ -f $file ]] || { echo "Missing $file" >&2; exit 1; }
done

if ! (cd "$(dirname "$dump")" && sha256sum --check --status "$(basename "$dump").sha256"); then
  echo "Checksum mismatch: $dump" >&2
  exit 1
fi

json=$(<"$dump.json")
field() { sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p" <<< "$json"; }

# --maintenance-db keeps the drop and create off the live database's connections.
scratch() { "$1" --maintenance-db=postgres "${@:2}"; }
cleanup() { scratch dropdb --if-exists "$RESTORE_DB" || echo "Could not drop $RESTORE_DB" >&2; }
trap cleanup EXIT

scratch dropdb --if-exists "$RESTORE_DB"
scratch createdb "$RESTORE_DB"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DB" "$dump"

actual=$(psql -X -A -t -v ON_ERROR_STOP=1 --dbname="$RESTORE_DB" -c "SELECT concat_ws('|',
  (SELECT max(filename) FROM schema_migrations), (SELECT count(*) FROM users),
  (SELECT count(*) FROM tasks), (SELECT count(*) FROM collections));")
expected="$(field migration)|$(field users)|$(field tasks)|$(field collections)"
if [[ $actual != "$expected" ]]; then
  echo "Restore check failed: restored '$actual', dump recorded '$expected'" >&2
  exit 1
fi
echo "Restore check passed: $(basename "$dump") (migration|users|tasks|collections = $actual)" >&2
