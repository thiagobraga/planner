#!/usr/bin/env bash
set -euo pipefail

SCRIPT=$(cd "$(dirname "$0")" && pwd)/check-line-limits.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q
mkdir -p app/src app/src/__tests__ api/src/db/migrations
touch baseline.tsv

write_lines() { awk -v count="$2" 'BEGIN { for (i = 0; i < count; i++) print "line" }' > "$1"; }
expect_pass() { CHECK_ROOT="$tmp" LINE_LIMIT_BASELINE="$tmp/baseline.tsv" bash "$SCRIPT" > "$tmp/result" 2>&1 || { cat "$tmp/result"; exit 1; }; }
expect_fail() { if CHECK_ROOT="$tmp" LINE_LIMIT_BASELINE="$tmp/baseline.tsv" bash "$SCRIPT" > "$tmp/result" 2>&1; then echo "Expected failure: $1" >&2; exit 1; fi; grep -q "$1" "$tmp/result"; }

write_lines app/src/within.ts 419
git add .
expect_pass

write_lines app/src/within.ts 420
expect_fail 'app/src/within.ts'

write_lines app/src/__tests__/large.test.ts 500
write_lines api/src/db/migrations/053_generated.sql 500
write_lines app/src/generated.d.ts 500
git add .
expect_fail 'app/src/within.ts'
write_lines app/src/within.ts 419
expect_pass

write_lines app/src/legacy.ts 500
git add .
sha=$(sha256sum app/src/legacy.ts | cut -d' ' -f1)
printf 'app/src/legacy.ts\t500\t%s\n' "$sha" > baseline.tsv
expect_pass

printf 'changed\n' >> app/src/legacy.ts
expect_fail 'app/src/legacy.ts'

echo 'all passed'
