#!/usr/bin/env bash
set -euo pipefail

SCRIPT=$(cd "$(dirname "$0")" && pwd)/check-contracts.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/api/src/contracts" "$tmp/app/src/contracts"

expect_pass() { CONTRACT_ROOT="$tmp" bash "$SCRIPT" > "$tmp/result" 2>&1 || { cat "$tmp/result"; exit 1; }; }
expect_fail() { if CONTRACT_ROOT="$tmp" bash "$SCRIPT" > "$tmp/result" 2>&1; then echo "Expected failure: $1" >&2; exit 1; fi; grep -q "$1" "$tmp/result"; }

expect_pass
printf 'export type Sync = string;\n' > "$tmp/api/src/contracts/sync.ts"
expect_fail 'sync.ts'
cp "$tmp/api/src/contracts/sync.ts" "$tmp/app/src/contracts/sync.ts"
expect_pass
printf 'export type Sync = number;\n' > "$tmp/app/src/contracts/sync.ts"
expect_fail 'sync.ts'

echo 'all passed'
