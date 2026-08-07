#!/usr/bin/env bash
# Points git at the versioned hooks in .hooks/. Run once per clone.
#
# Undo with: git config --unset core.hooksPath

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .hooks
chmod +x .hooks/pre-commit .hooks/pre-push

echo "Hooks enabled (core.hooksPath = .hooks)"
echo
echo "  pre-commit   lint, for the packages the commit touches"
echo "  pre-push     lint + test + build, matching CI"
echo
echo "Bypass once with --no-verify, or export SKIP_HOOKS=1 for a session."
