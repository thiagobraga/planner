#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/bin" "$ROOT/tmp" "$ROOT/backups"
cat > "$ROOT/bin/docker" <<'MOCK'
#!/usr/bin/env bash
if [[ $1 == exec && $3 == cat ]]; then
  case "${*: -1}" in
    */postgres_user) echo planner ;;
    */postgres_db) echo planner_test ;;
    */postgres_password) echo 'pass:word' ;;
  esac
elif [[ $1 == exec && $3 == psql ]]; then
  if [[ $* == *server_version_num* ]]; then echo 160002; else echo 'PostgreSQL 16'; fi
elif [[ $1 == run ]]; then
  if [[ ${MOCK_RUN_MODE:-} == success ]]; then
    printf '%s\n' "$*" > "$MOCK_RUN_ARGS"
    echo /backups/example.dump
    exit 0
  fi
  echo $$ > "$MOCK_RUN_PID"
  touch "$MOCK_RUN_MARKER"
  while :; do sleep 0.1; done
fi
MOCK
chmod +x "$ROOT/bin/docker"
export MOCK_RUN_PID="$ROOT/run.pid" MOCK_RUN_MARKER="$ROOT/running"
export MOCK_RUN_ARGS="$ROOT/args"
export BACKUP_DIR="$ROOT/backups" TMPDIR="$ROOT/tmp" PATH="$ROOT/bin:$PATH"

mapped=$(
  source "$SCRIPT_DIR/db-docker.sh"
  BACKUP_KEEP_DUMP="$BACKUP_DIR/selected.dump" MOCK_RUN_MODE=success db_in_docker db-backup.sh
)
[[ $mapped == "$BACKUP_DIR/example.dump" ]] || { echo 'FAIL: backup output path not mapped' >&2; exit 1; }
grep -q -- '-e BACKUP_KEEP_DUMP=/backups/selected.dump' "$MOCK_RUN_ARGS" ||
  { echo 'FAIL: protected dump path not mapped' >&2; exit 1; }

(
  source "$SCRIPT_DIR/db-docker.sh"
  db_in_docker db-backup.sh
) > "$ROOT/out" 2>&1 &
runner=$!
for _ in $(seq 1 100); do [[ -e $MOCK_RUN_MARKER ]] && break; sleep 0.05; done
[[ -e $MOCK_RUN_MARKER ]] || { echo 'FAIL: docker run did not start' >&2; exit 1; }
[[ -n $(find "$ROOT/tmp" -mindepth 1 -maxdepth 1 -print -quit) ]] || { echo 'FAIL: no pgpass temp dir' >&2; exit 1; }
kill -TERM "$runner"
kill -TERM "$(<"$MOCK_RUN_PID")" 2>/dev/null || true
wait "$runner" 2>/dev/null || true
for _ in $(seq 1 100); do
  [[ -z $(find "$ROOT/tmp" -mindepth 1 -maxdepth 1 -print -quit) ]] && break
  sleep 0.05
done
[[ -z $(find "$ROOT/tmp" -mindepth 1 -maxdepth 1 -print -quit) ]] || { echo 'FAIL: pgpass temp dir left after termination' >&2; exit 1; }

echo 'db-docker: interrupted cleanup passed'
