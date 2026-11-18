#!/usr/bin/env bash
# Runs db-backup.sh against a real postgres reachable through PG* env (PGHOST, PGPORT,
# PGUSER, PGPASSWORD or PGPASSFILE). Uses its own source database, dropped at the end.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_ROOT=$(mktemp -d)
export PGDATABASE=backup_test_src BACKUP_DIR="$TEMP_ROOT/backups" BACKUP_SHA=abc123
trap 'dropdb --maintenance-db=postgres --if-exists "$PGDATABASE" || true; rm -rf "$TEMP_ROOT"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

dropdb --maintenance-db=postgres --if-exists "$PGDATABASE"
createdb --maintenance-db=postgres "$PGDATABASE"
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE schema_migrations (id SERIAL PRIMARY KEY, filename VARCHAR(255) UNIQUE NOT NULL);
INSERT INTO schema_migrations (filename) VALUES ('001_init.sql'), ('048_latest.sql');
CREATE TABLE users (id SERIAL PRIMARY KEY);
CREATE TABLE collections (id SERIAL PRIMARY KEY);
CREATE TABLE tasks (id SERIAL PRIMARY KEY);
INSERT INTO users SELECT FROM generate_series(1, 3);
INSERT INTO collections SELECT FROM generate_series(1, 2);
INSERT INTO tasks SELECT FROM generate_series(1, 5);
SQL

# Dump with sidecars and owner-only mode.
dump=$(bash "$SCRIPT_DIR/db-backup.sh")
[[ -f $dump && $dump == "$BACKUP_DIR/"*-abc123.dump ]] || fail "Unexpected dump path: $dump"
fast_dump=$(bash "$SCRIPT_DIR/db-backup.sh")
[[ $fast_dump != "$dump" && -f $dump ]] || fail "Rapid backup overwrote the prior dump"
[[ $(stat -c %a "$dump") == 600 ]] || fail "Dump is not mode 600"
(cd "$BACKUP_DIR" && sha256sum -c -s "$(basename "$dump").sha256") || fail "Checksum sidecar does not match"
grep -q '"migration":"048_latest.sql"' "$dump.json" || fail "Migration not recorded"
grep -q '"counts":{"users":3,"tasks":5,"collections":2}' "$dump.json" || fail "Counts not recorded: $(<"$dump.json")"
pg_restore --list "$dump" > /dev/null || fail "Dump is not a custom-format archive"

# Low disk: refuse when free space is under twice the last dump.
before_count=$(find "$BACKUP_DIR" -name '*.dump' | wc -l)
if DB_BACKUP_FREE_KB=0 bash "$SCRIPT_DIR/db-backup.sh" 2> "$TEMP_ROOT/err"; then fail "Low disk was accepted"; fi
grep -q 'Refusing backup' "$TEMP_ROOT/err" || fail "Low disk refusal message missing"
[[ $(find "$BACKUP_DIR" -name '*.dump' | wc -l) == "$before_count" ]] || fail "Low disk refusal left a dump"

# Retention keeps the newest N dumps and their sidecars.
for _ in 1 2; do
  sleep 1
  BACKUP_RETENTION=2 BACKUP_KEEP_DUMP="$dump" bash "$SCRIPT_DIR/db-backup.sh" > /dev/null
done
[[ -e $dump && -e $dump.json && -e $dump.sha256 ]] || fail "Selected restore dump was pruned"
BACKUP_RETENTION=2 bash "$SCRIPT_DIR/db-backup.sh" > /dev/null
[[ $(find "$BACKUP_DIR" -name '*.dump' | wc -l) == 2 ]] || fail "Retention did not prune old dumps"
[[ ! -e $dump && ! -e $dump.json && ! -e $dump.sha256 ]] || fail "Pruned dump left sidecars"

# Bad input is rejected before touching the database.
if BACKUP_SHA='x;rm' bash "$SCRIPT_DIR/db-backup.sh" 2> /dev/null; then fail "Unsafe BACKUP_SHA was accepted"; fi
if BACKUP_RETENTION=0 bash "$SCRIPT_DIR/db-backup.sh" 2> /dev/null; then fail "Zero retention was accepted"; fi

echo 'db-backup: 5 scenarios passed'
