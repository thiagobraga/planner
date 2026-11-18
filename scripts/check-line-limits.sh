#!/usr/bin/env bash
set -euo pipefail

root=${CHECK_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
baseline=${LINE_LIMIT_BASELINE:-$root/scripts/line-limits-baseline.tsv}
limit=419
failed=0

cd "$root"
[[ -f $baseline ]] || { echo "Missing line limit baseline: $baseline" >&2; exit 2; }

while IFS= read -r -d '' file; do
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.sh) ;;
    *) continue ;;
  esac
  case "$file" in
    */__tests__/*|*/e2e/*|*/migrations/*|*/generated/*|*.test.*|*.spec.*|*.d.ts|*.test.sh) continue ;;
  esac
  [[ -f $file ]] || continue
  lines=$(awk 'END { print NR }' "$file")
  (( lines <= limit )) && continue

  expected=$(awk -F '\t' -v path="$file" '$1 == path { print $2 " " $3; exit }' "$baseline")
  actual="$lines $(sha256sum "$file" | cut -d' ' -f1)"
  if [[ $expected != "$actual" ]]; then
    echo "$file: $lines lines exceeds $limit; split this file before changing it" >&2
    failed=1
  fi
done < <(git ls-files -z)

exit "$failed"
