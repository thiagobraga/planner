#!/usr/bin/env bash
# List the N biggest project files by line count, largest first.
#
# Usage: scripts/biggest-files.sh [N]
#   N defaults to 20.
#
# Only lists project files: tracked files plus untracked files that are
# not ignored (git ls-files with --exclude-standard, so .gitignore rules
# apply and ignored paths like node_modules, dist, coverage, .env stay out).
set -euo pipefail

N="${1:-20}"
[[ "$N" =~ ^[0-9]+$ ]] && [ "$N" -gt 0 ] || { echo "Usage: scripts/biggest-files.sh [N] (positive integer)" >&2; exit 1; }
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git ls-files --cached --others --exclude-standard -z | while IFS= read -r -d '' file; do
  [ -f "$file" ] || continue
  base="${file##*/}"
  case "$base" in
    package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lock*|*.lock) continue ;;
  esac
  lower=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico|*.webp|*.avif|*.bmp|*.tiff|*.tif|*.heic|*.heif|*.icns) continue ;;
  esac
  lines=$(wc -l < "$file")
  printf '%s %s\n' "$lines" "$file"
done | sort -rn | head -n "$N" || true
