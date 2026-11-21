#!/usr/bin/env bash
set -euo pipefail

root=${CONTRACT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
api="$root/api/src/contracts"
app="$root/app/src/contracts"
[[ -d $api && -d $app ]] || { echo "Both contract directories are required" >&2; exit 1; }

failed=0
while IFS= read -r -d '' file; do
  name=${file##*/}
  if [[ ! -f $app/$name ]] || ! cmp -s "$file" "$app/$name"; then
    echo "Contract drift: $name" >&2
    failed=1
  fi
done < <(find "$api" -maxdepth 1 -type f -name '*.ts' -print0)
while IFS= read -r -d '' file; do
  name=${file##*/}
  if [[ ! -f $api/$name ]]; then
    echo "Contract drift: $name" >&2
    failed=1
  fi
done < <(find "$app" -maxdepth 1 -type f -name '*.ts' -print0)
exit "$failed"
