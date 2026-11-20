#!/usr/bin/env bash
set -euo pipefail

fail() { echo "$*" >&2; exit 1; }

force=false
case "${*:-}" in
  '') ;;
  --force) force=true ;;
  *) fail "Usage: $0 [--force]" ;;
esac

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"
PUBLIC_URL=${PUBLIC_URL:-${CORS_ORIGIN:-}}
[[ -n $PUBLIC_URL ]] || fail "Set PUBLIC_URL or CORS_ORIGIN to verify the API"
DEPLOY_DIR="$ROOT_DIR/deploy"
mkdir -p "$DEPLOY_DIR"
exec 9>"$DEPLOY_DIR/.deploy.lock"
flock -n 9 || fail "Another deployment is running"

# shellcheck source=scripts/db-docker.sh
source scripts/db-docker.sh
# shellcheck source=scripts/prod-postgres.sh
source scripts/prod-postgres.sh
project=$(prod_shared_project "$PG_CONTAINER")
volume="${project}_pgdata18"
ready="$DEPLOY_DIR/.postgres-18-ready"
[[ ! -e $ready ]] || fail "PostgreSQL 18 cutover already recorded"
[[ $(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER") == healthy ]] ||
  fail "Source PostgreSQL container must be healthy"
old_volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$PG_CONTAINER")
[[ $old_volume == "${project}_pgdata" ]] || fail "Unexpected PostgreSQL 16 data volume: $old_volume"
if docker volume inspect "$volume" >/dev/null 2>&1; then
  fail "Target volume $volume already exists. Inspect it before retrying."
fi

user=$(db_secret postgres_user)
db=$(db_secret postgres_db)
sql() {
  local container=$1
  shift
  docker exec -i "$container" psql -XAt -v ON_ERROR_STOP=1 -U "$user" -d "$db" "$@"
}
version=$(sql "$PG_CONTAINER" -c 'SHOW server_version_num')
[[ $version =~ ^16[0-9]{4}$ ]] || fail "Expected PostgreSQL 16, found $version"
bytes=$(sql "$PG_CONTAINER" -c 'SELECT pg_database_size(current_database())')
echo "Source database size: $bytes bytes" >&2
if (( bytes > 1073741824 )) && [[ $force != true ]]; then
  fail "Database exceeds 1 GiB. Evaluate pg_upgrade or use --force after measuring downtime."
fi
export BACKUP_DIR=${BACKUP_DIR:-$DEPLOY_DIR/backups/postgres18}
(
  umask 077
  mkdir -p "$BACKUP_DIR"
)
available=$(df -Pk "$BACKUP_DIR" | awk 'NR == 2 { print $4 }')
docker_root=$(docker info --format '{{.DockerRootDir}}')
docker_available=$(df -Pk "$docker_root" | awk 'NR == 2 { print $4 }')
if (( available < (2 * bytes + 1023) / 1024 || docker_available < (2 * bytes + 1023) / 1024 )); then
  fail "Need at least twice the database size free on the backup and Docker filesystems"
fi

active=$(<"$DEPLOY_DIR/.active-color")
[[ $active == blue || $active == green ]] || fail "Invalid active color: $active"
active_api="planner-$active-api"
is_running() { [[ $(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true) == true ]]; }
is_running "$active_api" || fail "Active API $active_api is not running"

image=$(prod_shared_compose "$project" 18 config --images postgres)
docker pull "$image"
# Preload the legacy image and both backup clients before stopping writers.
prod_shared_compose "$project" 16 pull postgres
docker pull postgres:16
docker pull postgres:18

tmp=$(mktemp -d)
staging="${project}-postgres18-stage"
stage_started=false
switch_started=false
writers_may_have_started=false
paused=()

# shellcheck disable=SC2329 # called by the EXIT trap
cleanup() {
  local status=$?
  trap - EXIT
  if [[ $stage_started == true ]]; then docker rm -f "$staging" >/dev/null || true; fi
  rm -rf "$tmp"
  if (( status != 0 )) && [[ $writers_may_have_started == false ]]; then
    if [[ $switch_started == true ]]; then
      rm -f "$ready"
      if ! prod_shared_compose "$project" 16 up --wait --wait-timeout 150 -d --no-deps --force-recreate postgres ||
         ! sql "$PG_CONTAINER" -c 'SHOW server_version_num' | grep -Eq '^16[0-9]{4}$'; then
        fail "Could not restore PostgreSQL 16. API writers are still stopped."
      fi
      echo "Retained PostgreSQL 16 cluster restored" >&2
    fi
    for api in "${paused[@]}"; do
      docker start "$api" >/dev/null || echo "Could not restart $api" >&2
    done
  fi
  if (( status != 0 )) && [[ $writers_may_have_started == true ]]; then
    echo "PostgreSQL 18 is selected. Preserve any new writes and investigate API health." >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pre=$(BACKUP_SHA=pg18rehearsal bash scripts/db-backup.sh --docker)
db_secret postgres_user > "$tmp/postgres_user"
db_secret postgres_db > "$tmp/postgres_db"
db_secret postgres_password > "$tmp/postgres_password"
chmod 600 "$tmp"/postgres_*
docker volume create "$volume" >/dev/null
docker run -d --rm --name "$staging" --network none \
  --mount "type=volume,source=$volume,target=/var/lib/postgresql" \
  --mount "type=bind,source=$tmp,target=/run/secrets,readonly" \
  -e POSTGRES_USER_FILE=/run/secrets/postgres_user \
  -e POSTGRES_DB_FILE=/run/secrets/postgres_db \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password "$image" >/dev/null
stage_started=true
for _ in {1..60}; do
  if docker exec "$staging" pg_isready -q -h 127.0.0.1 -U "$user" -d "$db"; then break; fi
  sleep 2
done
PG_CONTAINER=$staging bash scripts/db-restore-check.sh --docker "$pre"

table_counts() {
  sql "$1" <<'SQL'
SELECT format('SELECT %L, count(*) FROM ONLY %I.%I',
              quote_ident(schemaname) || '.' || quote_ident(tablename), schemaname, tablename)
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND schemaname !~ '^pg_(toast|temp)'
ORDER BY schemaname COLLATE "C", tablename COLLATE "C"
\gexec
SQL
}

for api in planner-blue-api planner-green-api planner-prod-api; do
  if is_running "$api"; then
    paused+=("$api")
    docker stop -t 15 "$api" >/dev/null
  fi
done
final=$(BACKUP_SHA=pg18cutover BACKUP_KEEP_DUMP="$pre" bash scripts/db-backup.sh --docker)
table_counts "$PG_CONTAINER" > "$tmp/source.counts"
(cd "$BACKUP_DIR" && sha256sum --check --status "$(basename "$final").sha256")
docker exec -i "$staging" pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
  -U "$user" -d "$db" < "$final"
table_counts "$staging" > "$tmp/staging.counts"
cmp -s "$tmp/source.counts" "$tmp/staging.counts" || fail "Staged row counts differ from PostgreSQL 16"
docker exec "$staging" vacuumdb --analyze-only -U "$user" -d "$db"
docker exec "$staging" sh -ec 'touch "$PGDATA/.planner-upgrade-ready"'
docker stop -t 30 "$staging" >/dev/null
stage_started=false

switch_started=true
prod_shared_compose "$project" 18 up --wait --wait-timeout 150 -d --no-deps --force-recreate postgres
version=$(sql "$PG_CONTAINER" -c 'SHOW server_version_num')
[[ $version =~ ^18[0-9]{4}$ ]] || fail "Expected PostgreSQL 18, found $version"
table_counts "$PG_CONTAINER" > "$tmp/live.counts"
cmp -s "$tmp/source.counts" "$tmp/live.counts" || fail "Production row counts differ after replacement"

printf '18\n' > "$ready"
# Once an API writer can connect, PostgreSQL 18 is authoritative.
writers_may_have_started=true
for api in "${paused[@]}"; do docker start "$api" >/dev/null; done
for _ in {1..30}; do
  if docker exec "$active_api" wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1 &&
     curl --fail --silent --max-time 5 "${PUBLIC_URL%/}/api/v1/health" >/dev/null; then
    echo "PostgreSQL 18 active. Verified backup: $final"
    echo "Retain $old_volume through at least $(date -u -d '+14 days' +%F) UTC."
    exit 0
  fi
  sleep 5
done
fail "API health check failed after PostgreSQL cutover"
