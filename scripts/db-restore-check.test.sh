#!/usr/bin/env bash
# Runs db-restore-check.sh against a real postgres reachable through PG* env.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_ROOT=$(mktemp -d)
export PGDATABASE=restore_test_src BACKUP_DIR="$TEMP_ROOT/backups" BACKUP_SHA=def456
export RESTORE_DB=restore_test_scratch
trap 'dropdb --maintenance-db=postgres --if-exists "$PGDATABASE" || true; rm -rf "$TEMP_ROOT"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
scratch_exists() {
  [[ $(psql -X -A -t -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$RESTORE_DB'") == 1 ]]
}

dropdb --maintenance-db=postgres --if-exists "$PGDATABASE"
createdb --maintenance-db=postgres "$PGDATABASE"
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE schema_migrations (id SERIAL PRIMARY KEY, filename VARCHAR(255) UNIQUE NOT NULL);
INSERT INTO schema_migrations (filename) VALUES ('047_prev.sql'), ('048_latest.sql');
CREATE TABLE users (id SERIAL PRIMARY KEY);
CREATE TABLE collections (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id));
CREATE TABLE tasks (id SERIAL PRIMARY KEY, collection_id INT REFERENCES collections(id));
INSERT INTO users SELECT FROM generate_series(1, 4);
INSERT INTO collections (user_id) SELECT 1 FROM generate_series(1, 3);
INSERT INTO tasks (collection_id) SELECT 1 FROM generate_series(1, 7);
SQL
dump=$(bash "$SCRIPT_DIR/db-backup.sh")
# Writes after the dump must not leak into the comparison.
psql -X -q -c 'INSERT INTO tasks (collection_id) VALUES (1)'

# Dump, restore, compare, drop.
bash "$SCRIPT_DIR/db-restore-check.sh" "$dump" 2> "$TEMP_ROOT/err" || fail "Restore check failed: $(<"$TEMP_ROOT/err")"
grep -q 'Restore check passed' "$TEMP_ROOT/err" || fail "Missing pass message"
scratch_exists && fail "Scratch database was not dropped"
[[ $(psql -X -A -t -c 'SELECT count(*) FROM tasks') == 8 ]] || fail "Live database changed"

# Count mismatch fails and still drops the scratch database.
cp "$dump.json" "$TEMP_ROOT/good.json"
sed -i 's/"tasks":7/"tasks":9/' "$dump.json"
if bash "$SCRIPT_DIR/db-restore-check.sh" "$dump" 2> "$TEMP_ROOT/err"; then fail "Count mismatch was accepted"; fi
grep -q 'Restore check failed' "$TEMP_ROOT/err" || fail "Missing mismatch message"
scratch_exists && fail "Scratch database left after a failed check"
cp "$TEMP_ROOT/good.json" "$dump.json"

# A corrupted dump fails the checksum before any restore.
cp "$dump" "$TEMP_ROOT/good.dump"
printf 'x' >> "$dump"
if bash "$SCRIPT_DIR/db-restore-check.sh" "$dump" 2> "$TEMP_ROOT/err"; then fail "Corrupt dump was accepted"; fi
grep -q 'Checksum mismatch' "$TEMP_ROOT/err" || fail "Missing checksum message"
scratch_exists && fail "Corrupt dump reached a restore"
cp "$TEMP_ROOT/good.dump" "$dump"

# The live database is never a restore target.
if RESTORE_DB=$PGDATABASE bash "$SCRIPT_DIR/db-restore-check.sh" "$dump" 2> "$TEMP_ROOT/err"; then
  fail "Restoring over the live database was accepted"
fi
grep -q 'Refusing to restore over the live database' "$TEMP_ROOT/err" || fail "Missing live database refusal"
[[ $(psql -X -A -t -c 'SELECT count(*) FROM tasks') == 8 ]] || fail "Live database changed"

if RESTORE_DB='x; drop' bash "$SCRIPT_DIR/db-restore-check.sh" "$dump" 2> /dev/null; then fail "Unsafe RESTORE_DB was accepted"; fi

echo 'db-restore-check: 5 scenarios passed'
