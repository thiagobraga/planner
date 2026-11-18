#!/usr/bin/env bash
# Dumps PGDATABASE with pg_dump -Fc into BACKUP_DIR/<utc>-<sha>.dump plus .sha256 and
# .json sidecars, then keeps the newest BACKUP_RETENTION dumps. Connection comes only
# from PG* env (password via PGPASSFILE). Prints the dump path on stdout.
#   db-backup.sh            run with the local pg client
#   db-backup.sh --docker   run against the prod postgres container (see db-docker.sh)
set -euo pipefail

if [[ ${1:-} == --docker ]]; then
  # shellcheck source=scripts/db-docker.sh
  source "$(dirname "${BASH_SOURCE[0]}")/db-docker.sh"
  db_in_docker db-backup.sh
  exit
fi

BACKUP_DIR=${BACKUP_DIR:-deploy/backups}
BACKUP_RETENTION=${BACKUP_RETENTION:-14}
BACKUP_SHA=${BACKUP_SHA:-$(git rev-parse --short=12 HEAD 2>/dev/null || echo manual)}
: "${PGDATABASE:?Set PGDATABASE}"

if [[ ! $BACKUP_RETENTION =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION must be a positive integer" >&2
  exit 2
fi
if [[ ! $BACKUP_SHA =~ ^[0-9A-Za-z]{1,40}$ ]]; then
  echo "BACKUP_SHA must be alphanumeric" >&2
  exit 2
fi

umask 077
mkdir -p "$BACKUP_DIR"

# Free space in KiB; DB_BACKUP_FREE_KB overrides it so tests can simulate a full disk.
free_kb() {
  if [[ -n ${DB_BACKUP_FREE_KB:-} ]]; then echo "$DB_BACKUP_FREE_KB"; return; fi
  df -Pk "$BACKUP_DIR" | awk 'NR == 2 { print $4 }'
}

dump_files_newest() {
  local file
  while IFS= read -r -d '' file; do stat -c '%Y %n' "$file"; done \
    < <(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f -print0) |
    sort -rn | cut -d' ' -f2-
}
mapfile -t dumps < <(dump_files_newest)
last_dump=${dumps[0]:-}
if [[ -n $last_dump ]]; then
  last_kb=$(( ($(stat -c %s "$last_dump") + 1023) / 1024 ))
  available=$(free_kb)
  if (( available < 2 * last_kb )); then
    echo "Refusing backup: ${available} KiB free, need 2x last dump (${last_kb} KiB)" >&2
    exit 1
  fi
fi

name="$(date -u +%Y%m%dT%H%M%SZ)-$BACKUP_SHA"
dump="$BACKUP_DIR/$name.dump"
partial="$dump.partial"
while [[ -e $dump || -e $partial ]]; do
  sleep 1
  name="$(date -u +%Y%m%dT%H%M%SZ)-$BACKUP_SHA"
  dump="$BACKUP_DIR/$name.dump"
  partial="$dump.partial"
done
cleanup() { rm -f "$partial" "$partial.json"; }
trap cleanup EXIT

# The counts and the dump share one exported snapshot, so the restore check compares
# like with like even while the app keeps writing.
coproc PSQL { psql -X -q -A -t -v ON_ERROR_STOP=1 2>&1; }
# shellcheck disable=SC2153 # set by coproc
psql_pid=$PSQL_PID
psql_query() {
  local line
  printf '%s\n' "$1" >&"${PSQL[1]}"
  IFS= read -r -t 30 line <&"${PSQL[0]}" || { echo "psql did not answer" >&2; return 1; }
  printf '%s\n' "$line"
}
snapshot=$(psql_query 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();')
if [[ ! $snapshot =~ ^[0-9A-F-]+$ ]]; then
  echo "Could not export a snapshot: $snapshot" >&2
  exit 1
fi
facts=$(psql_query "SELECT concat_ws('|', current_setting('server_version_num'),
  (SELECT max(filename) FROM schema_migrations), (SELECT count(*) FROM users),
  (SELECT count(*) FROM tasks), (SELECT count(*) FROM collections));")
IFS='|' read -r server_version migration users tasks collections <<< "$facts"
if [[ ! $users =~ ^[0-9]+$ || ! $tasks =~ ^[0-9]+$ || ! $collections =~ ^[0-9]+$ ]]; then
  echo "Could not read row counts: $facts" >&2
  exit 1
fi

pg_dump -Fc --snapshot="$snapshot" --file="$partial"
psql_query 'COMMIT; SELECT 1;' > /dev/null
printf '\\q\n' >&"${PSQL[1]}"
wait "$psql_pid" || true

size=$(stat -c %s "$partial")
checksum=$(sha256sum "$partial" | cut -d' ' -f1)
printf '{"file":"%s","created_at":"%s","sha":"%s","server_version_num":%s,"migration":"%s","size_bytes":%s,"sha256":"%s","counts":{"users":%s,"tasks":%s,"collections":%s}}\n' \
  "$name.dump" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BACKUP_SHA" "$server_version" "$migration" \
  "$size" "$checksum" "$users" "$tasks" "$collections" > "$partial.json"
mv -f "$partial" "$dump"
printf '%s  %s\n' "$checksum" "$name.dump" > "$dump.sha256"
mv -f "$partial.json" "$dump.json"
chmod 600 "$dump" "$dump.sha256" "$dump.json"

mapfile -t dumps < <(dump_files_newest)
for ((i = BACKUP_RETENTION; i < ${#dumps[@]}; i++)); do
  old=${dumps[i]}
  [[ $old == "${BACKUP_KEEP_DUMP:-}" ]] && continue
  rm -f "$old" "$old.sha256" "$old.json"
done

echo "Backup written: $name.dump ($size bytes)" >&2
printf '%s\n' "$dump"
