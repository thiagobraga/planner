#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TEMP_ROOT=$(mktemp -d)
REAL_DOCKER=$(command -v docker)
PREFIX="pg18-ci-$$-$RANDOM"
PROJECT=
CASE_ROOT=
export REAL_DOCKER

fail() { echo "FAIL: $*" >&2; exit 1; }
cleanup_case() {
  [[ -n $PROJECT ]] || return 0
  local -a containers
  mapfile -t containers < <("$REAL_DOCKER" ps -aq --filter "label=com.docker.compose.project=$PROJECT")
  "$REAL_DOCKER" rm -fv "$API_CONTAINER" "$OTHER_API_CONTAINER" >/dev/null 2>&1 || true
  if (( ${#containers[@]} )); then
    "$REAL_DOCKER" rm -fv "${containers[@]}" >/dev/null 2>&1 || true
  fi
  "$REAL_DOCKER" network rm "$PROJECT-prod-data" "$PROJECT-prod-backend" "$PROJECT-prod-edge" "$PROJECT-prod-egress" >/dev/null 2>&1 || true
  "$REAL_DOCKER" volume rm "${PROJECT}_pgdata" "${PROJECT}_pgdata18" >/dev/null 2>&1 || true
  PROJECT=
}
finish() {
  local status=$?
  if (( status != 0 )) && [[ -f $CASE_ROOT/upgrade.log ]]; then cat "$CASE_ROOT/upgrade.log" >&2; fi
  cleanup_case
  rm -rf "$TEMP_ROOT"
}
trap finish EXIT

[[ -f $ROOT/scripts/postgres-upgrade.sh ]] || fail "scripts/postgres-upgrade.sh is missing"
[[ -f $ROOT/compose.prod.pg16.yml ]] || fail "compose.prod.pg16.yml is missing"

mkdir -p "$TEMP_ROOT/bin"
cat > "$TEMP_ROOT/bin/docker" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do
  case "$arg" in
    *planner-prod-*|*planner-blue-*|*planner-green-*) echo "Refusing non-test container: $arg" >&2; exit 90 ;;
  esac
done

if [[ ${1:-} == exec && ${2:-} == "$API_CONTAINER" && ${3:-} == wget ]]; then
  [[ $("$REAL_DOCKER" inspect -f '{{.State.Running}}' "$API_CONTAINER") == true ]]
  exit
fi

if [[ ${CORRUPT_BACKUP:-0} == 1 ]]; then
  if [[ ${1:-} == run && ${*: -2:1} == /scripts/db-restore-check.sh ]]; then
    archive=${*: -1}
    printf 'test corruption' >> "$CASE_ROOT/deploy/backups/postgres18/${archive##*/}"
  elif [[ ${1:-} == stop && ${*: -1} == "$API_CONTAINER" ]]; then
    touch "$CASE_ROOT/writer-stopped"
  fi
fi

case "${1:-}" in
  compose)
    if [[ " $* " == *' up '* && ${*: -1} == postgres ]]; then
      if [[ " $* " != *'compose.prod.pg16.yml'* ]]; then
        for api in "$API_CONTAINER" "$OTHER_API_CONTAINER"; do
          [[ $("$REAL_DOCKER" inspect -f '{{.State.Running}}' "$api") == false ]] || exit 91
        done
        "$REAL_DOCKER" "$@"
        if [[ ${FAIL_SWITCH:-0} == 1 ]]; then
          printf 'PG18 started before injected failure\n' > "$CASE_ROOT/switch-failure"
          exit 92
        fi
        exit 0
      fi
    fi
    ;;
esac
exec "$REAL_DOCKER" "$@"
SHIM
cat > "$TEMP_ROOT/bin/curl" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
[[ $("$REAL_DOCKER" inspect -f '{{.State.Running}}' "$API_CONTAINER") == true ]]
while (( $# )); do
  case "$1" in
    -D|--dump-header)
      if [[ $2 == - ]]; then
        printf 'HTTP/1.1 200 OK\r\nX-Planner-Color: blue\r\n\r\n'
      else
        printf 'HTTP/1.1 200 OK\r\nX-Planner-Color: blue\r\n\r\n' > "$2"
      fi
      shift
      ;;
  esac
  shift
done
SHIM
chmod +x "$TEMP_ROOT/bin/docker" "$TEMP_ROOT/bin/curl"

sql() { "$REAL_DOCKER" exec -i "$PG_CONTAINER" psql -XAtq -v ON_ERROR_STOP=1 -U planner -d planner "$@"; }
assert_state() {
  local major=$1
  [[ $(sql -c "SELECT current_setting('server_version_num')::int / 10000") == "$major" ]] ||
    fail "Expected PostgreSQL $major"
  [[ $(sql -c 'SELECT title FROM tasks ORDER BY id') == $'preserved\nsecond task' ]] || fail "Task payload changed"
  [[ $(sql -c 'SELECT count(*) FROM custom.notes') == 4 ]] || fail "Non-public table rows changed"
  [[ $(sql -c 'SELECT last_value FROM tasks_id_seq') == 42 ]] || fail "Sequence state changed"
  [[ $("$REAL_DOCKER" inspect -f '{{.State.Running}}' "$API_CONTAINER") == true ]] || fail "Active API did not resume"
  [[ $("$REAL_DOCKER" inspect -f '{{.State.Running}}' "$OTHER_API_CONTAINER") == true ]] || fail "Secondary API did not resume"
  "$REAL_DOCKER" volume inspect "${PROJECT}_pgdata" >/dev/null || fail "PG16 volume was removed"
}

setup_case() {
  PROJECT="$PREFIX-$1"
  CASE_ROOT="$TEMP_ROOT/$1"
  PG_CONTAINER="$PROJECT-prod-postgres"
  API_CONTAINER="$PROJECT-blue-api"
  OTHER_API_CONTAINER="$PROJECT-green-api"
  export CASE_ROOT PG_CONTAINER API_CONTAINER OTHER_API_CONTAINER

  mkdir -p "$CASE_ROOT"/{scripts,secrets,deploy}
  local file
  for file in "$ROOT"/scripts/*.sh "$ROOT"/compose.prod.yml "$ROOT"/compose.prod.pg16.yml; do
    if [[ $file == */scripts/* ]]; then
      sed "s/planner-/$PROJECT-/g" "$file" > "$CASE_ROOT/scripts/${file##*/}"
    else
      sed -e "s/planner-/$PROJECT-/g" -e 's/interval: 10s/interval: 1s/g' "$file" > "$CASE_ROOT/${file##*/}"
    fi
  done
  printf 'blue\n' > "$CASE_ROOT/deploy/.active-color"
  printf 'planner\n' > "$CASE_ROOT/secrets/postgres_user"
  printf 'planner\n' > "$CASE_ROOT/secrets/postgres_db"
  printf 'test-only\n' > "$CASE_ROOT/secrets/postgres_password"
  PLANNER_POSTGRES_VOLUME="${PROJECT}_pgdata18" "$REAL_DOCKER" compose --project-name "$PROJECT" \
    -f "$CASE_ROOT/compose.prod.yml" -f "$CASE_ROOT/compose.prod.pg16.yml" \
    up --wait -d --no-deps postgres
  sql <<'SQL'
CREATE TABLE schema_migrations (filename text NOT NULL);
INSERT INTO schema_migrations VALUES ('055_test.sql');
CREATE TABLE users (id bigint PRIMARY KEY);
INSERT INTO users VALUES (1), (2);
CREATE TABLE collections (id bigint PRIMARY KEY);
INSERT INTO collections VALUES (1);
CREATE TABLE tasks (id bigserial PRIMARY KEY, title text NOT NULL);
INSERT INTO tasks (title) VALUES ('preserved'), ('second task');
ALTER SEQUENCE tasks_id_seq RESTART WITH 42;
SELECT setval('tasks_id_seq', 42);
CREATE EXTENSION "uuid-ossp";
CREATE INDEX tasks_fulltext_idx ON tasks USING GIN (to_tsvector('english', title));
CREATE SCHEMA custom;
CREATE TABLE custom.notes (id integer PRIMARY KEY);
INSERT INTO custom.notes SELECT generate_series(1, 4);
SQL
  local api
  for api in "$API_CONTAINER" "$OTHER_API_CONTAINER"; do
    "$REAL_DOCKER" run -d --name "$api" --network none --stop-signal SIGTERM --entrypoint sh postgres:16-alpine \
      -c 'trap "exit 0" TERM; while :; do sleep 3600 & wait "$!"; done' >/dev/null
  done
}

run_upgrade() {
  (
    cd "$CASE_ROOT"
    export PUBLIC_URL=https://planner.example.test PATH="$TEMP_ROOT/bin:$PATH"
    bash scripts/postgres-upgrade.sh
  ) > "$CASE_ROOT/upgrade.log" 2>&1
}

setup_case success
(
  flock -x 9
  if run_upgrade; then fail "Upgrade accepted a held deploy lock"; fi
  grep -Fq 'Another deployment is running' "$CASE_ROOT/upgrade.log" || fail "Wrong rejection for held lock"
) 9>"$CASE_ROOT/deploy/.deploy.lock"
assert_state 16
"$REAL_DOCKER" volume create "${PROJECT}_pgdata18" >/dev/null
if run_upgrade; then fail "Existing target volume was accepted"; fi
grep -Fq 'already exists' "$CASE_ROOT/upgrade.log" || fail "Wrong rejection for existing target"
"$REAL_DOCKER" volume rm "${PROJECT}_pgdata18" >/dev/null

if CORRUPT_BACKUP=1 run_upgrade; then fail "Corrupt rehearsal backup was accepted"; fi
grep -Fq 'Checksum mismatch' "$CASE_ROOT/upgrade.log" || fail "Wrong rejection for corrupted backup"
[[ ! -e $CASE_ROOT/writer-stopped ]] || fail "Active API was stopped before backup verification"
assert_state 16
"$REAL_DOCKER" volume rm "${PROJECT}_pgdata18" >/dev/null

run_upgrade || fail "PG16 to PG18 cutover"
assert_state 18
[[ -f $CASE_ROOT/deploy/.postgres-18-ready ]] || fail "Missing PG18 readiness marker"
[[ $(sql -c "SELECT to_regclass('tasks_fulltext_idx')") == tasks_fulltext_idx ]] || fail "Full-text index missing"
[[ $(sql -c "SELECT count(*) FROM pg_extension WHERE extname = 'uuid-ossp'") == 1 ]] || fail "Extension missing"
PG_CONTAINER="$PG_CONTAINER" BACKUP_SHA=afterupgrade bash "$CASE_ROOT/scripts/db-backup.sh" --docker > "$CASE_ROOT/dump-path"
PG_CONTAINER="$PG_CONTAINER" bash "$CASE_ROOT/scripts/db-restore-check.sh" --docker "$(cat "$CASE_ROOT/dump-path")"
if run_upgrade; then fail "Repeated upgrade accepted a live PG18 cluster"; fi
assert_state 18
cleanup_case

setup_case rollback
if FAIL_SWITCH=1 run_upgrade; then fail "Injected failure was accepted"; fi
[[ -f $CASE_ROOT/switch-failure ]] || fail "Injected failure did not follow actual PG18 startup"
[[ ! -e $CASE_ROOT/deploy/.postgres-18-ready ]] || fail "PG18 readiness marker survived rollback"
assert_state 16
echo 'PostgreSQL 18 upgrade, backup, restore check, and rollback passed'
