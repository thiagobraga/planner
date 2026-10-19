#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CLASSIFY="$SCRIPT_DIR/ci-changes.sh"
RELEASE_PR="$SCRIPT_DIR/fixtures/release-pr-0.5.1.json"

fail() { echo "FAIL: $*" >&2; exit 1; }
expect() {
  local want=$1 name=$2 got
  got=$(bash "$CLASSIFY")
  [[ $got == "$want" ]] || fail "$name: want $want, got $got"
  echo "ok: $name"
}

# Real release-please PR (#300): versions, lockfile headers, manifest, changelog.
expect true "real release PR" < "$RELEASE_PR"

# Same PR split over two pages, as `gh api --paginate` prints it.
{ jq -c '.[:4]' "$RELEASE_PR"; jq -c '.[4:]' "$RELEASE_PR"; } | expect true "paginated release PR"

jq '. + [{"filename":"api/src/index.ts","patch":"@@ -1 +1 @@\n-a\n+b"}]' "$RELEASE_PR" \
  | expect false "release PR plus a source file"

jq '(.[] | select(.filename == "api/package.json") | .patch) += "\n+    \"lodash\": \"^4.0.0\","' "$RELEASE_PR" \
  | expect false "version bump hiding a dependency line"

echo '[{"filename":"package.json","patch":"@@ -10 +10 @@\n-    \"vite\": \"^7.0.0\"\n+    \"vite\": \"^7.1.0\""}]' \
  | expect false "dependency bump without version change"

echo '[{"filename":"package-lock.json"}]' | expect false "lockfile without patch (too large to inspect)"

echo '[{"filename":".github/workflows/ci.yml","patch":"@@ -1 +1 @@\n-a\n+b"}]' | expect false "workflow change"

echo '[]' | expect false "empty change list"

echo '[{"filename":".release-manifest.json","patch":"@@ -1,3 +1,3 @@\n {\n-  \".\": \"0.5.0\"\n+  \".\": \"0.5.1\"\n }"}]' \
  | expect true "manifest only"

echo '[{"filename":"site/package.json","patch":"@@ -1 +1 @@\n-  \"version\": \"0.5.0\",\n+  \"version\": \"0.5.1\","}]' \
  | expect true "site version only"

echo '[{"filename":"site/package-lock.json","patch":"@@ -1 +1 @@\n-  \"react\": \"19.0.0\",\n+  \"react\": \"19.1.0\","}]' \
  | expect false "site dependency change"

echo '[{"filename":"app/src/styles/theme.css","patch":"@@ -1 +1 @@\n-a\n+b"}]' \
  | expect false "shared theme change"

echo "all passed"
