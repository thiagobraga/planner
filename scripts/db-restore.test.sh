#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/scripts" "$ROOT/deploy/backups" "$ROOT/bin"
cp "$SCRIPT_DIR/db-restore.sh" "$ROOT/scripts/"
cat > "$ROOT/scripts/db-docker.sh" <<'STUB'
db_in_docker() {
  printf 'restore %s\n' "$*" >> "$MOCK_LOG"
  [[ ${MOCK_FAIL_APPLY:-0} != 1 ]]
}
STUB
cat > "$ROOT/scripts/db-restore-check.sh" <<'STUB'
printf 'check %s\n' "$*" >> "$MOCK_LOG"
STUB
cat > "$ROOT/scripts/db-backup.sh" <<'STUB'
printf 'backup keep=%s\n' "${BACKUP_KEEP_DUMP:-}" >> "$MOCK_LOG"
if [[ ${BACKUP_KEEP_DUMP:-} != "$SELECTED_DUMP" ]]; then rm -f "$SELECTED_DUMP"; fi
echo "$ROOT/deploy/backups/safety.dump"
STUB
cat > "$ROOT/bin/docker" <<'MOCK'
#!/usr/bin/env bash
case "$1" in
  inspect)
    case "${*: -1}" in
      planner-blue-api|planner-green-api) echo true ;;
      planner-prod-api) echo false ;;
      *) exit 1 ;;
    esac
    ;;
  stop|start)
    printf '%s %s\n' "$1" "$*" >> "$MOCK_LOG"
    ;;
  exec)
    printf 'health %s\n' "$*" >> "$MOCK_LOG"
    ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$ROOT/bin/docker"
echo blue > "$ROOT/deploy/.active-color"
SELECTED_DUMP="$ROOT/deploy/backups/20261118T033000Z-old.dump"
export SELECTED_DUMP MOCK_LOG="$ROOT/log" ROOT
touch "$SELECTED_DUMP"

fail() { echo "FAIL: $*" >&2; exit 1; }
run_restore() {
  BACKUP_DIR="$ROOT/deploy/backups" BACKUP_RETENTION=1 PATH="$ROOT/bin:$PATH" \
    bash "$ROOT/scripts/db-restore.sh" "$(basename "$SELECTED_DUMP")" > "$ROOT/out" 2>&1
}

run_restore || fail "Restore failed: $(<"$ROOT/out")"
[[ -e $SELECTED_DUMP ]] || fail "Safety backup pruned requested dump"
grep -q '^stop .*planner-blue-api' "$MOCK_LOG" || fail "Active API not stopped"
grep -q '^stop .*planner-green-api' "$MOCK_LOG" || fail "Inactive running API not stopped"
stop_count=$(grep -c '^stop ' "$MOCK_LOG")
[[ $stop_count == 2 ]] || fail "Expected two running APIs to stop, got $stop_count"
restore_line=$(grep -n '^restore ' "$MOCK_LOG" | head -1 | cut -d: -f1)
last_stop=$(grep -n '^stop ' "$MOCK_LOG" | tail -1 | cut -d: -f1)
(( last_stop < restore_line )) || fail "Restore started before all APIs stopped"

: > "$MOCK_LOG"
if MOCK_FAIL_APPLY=1 run_restore; then fail "Failed restore succeeded"; fi
[[ $(grep -c '^start ' "$MOCK_LOG") == 2 ]] || fail "Failed restore did not restart both APIs"

echo 'db-restore: 2 scenarios passed'
