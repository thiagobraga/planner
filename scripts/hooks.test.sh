#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../.hooks/_lib.sh
source "$SCRIPT_DIR/../.hooks/_lib.sh"

expect_packages() {
  local want="$1" files="$2" got
  got=$(packages_touched_by "$files")
  if [[ "$got" != "$want" ]]; then
    printf 'FAIL: files=%s expected=%s actual=%s\n' "$files" "$want" "$got" >&2
    exit 1
  fi
}

expect_packages site 'site/src/App.tsx'
expect_packages app 'app/src/components/TaskItem.tsx'
expect_packages $'app\nsite' 'app/src/styles/theme.css'
expect_packages $'api\napp\nsite' $'api/src/index.ts\napp/src/styles/theme.css\nsite/src/App.tsx'
expect_packages '' 'README.md'
printf 'All hook package routing tests passed\n'
