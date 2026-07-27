#!/usr/bin/env bash
# Shared helpers for the hooks in this directory.
#
# Enabled per clone with:
#   ./scripts/setup-hooks.sh        (or: git config core.hooksPath .githooks)
#
# Bypass a single run with `git commit --no-verify` / `git push --no-verify`,
# or set SKIP_HOOKS=1 to turn the hooks off for a whole shell session.

set -uo pipefail

readonly PACKAGES=(api app)

REPO_ROOT="$(git rev-parse --show-toplevel)"
readonly REPO_ROOT

if [ -t 1 ]; then
  readonly C_DIM=$'\033[2m' C_RED=$'\033[31m' C_GREEN=$'\033[32m' C_YELLOW=$'\033[33m' C_OFF=$'\033[0m'
else
  readonly C_DIM='' C_RED='' C_GREEN='' C_YELLOW='' C_OFF=''
fi

hook_name=""

log()  { printf '%s\n' "${C_DIM}[${hook_name}]${C_OFF} $*"; }
warn() { printf '%s\n' "${C_YELLOW}[${hook_name}]${C_OFF} $*" >&2; }
fail() { printf '%s\n' "${C_RED}[${hook_name}]${C_OFF} $*" >&2; }

hooks_disabled() {
  [ "${SKIP_HOOKS:-0}" = "1" ]
}

# Which of PACKAGES the given file list touches. Anything outside api/ and app/
# (docs, .specs, compose files) matches nothing, so the hook exits doing no work.
packages_touched_by() {
  local files="$1" pkg
  for pkg in "${PACKAGES[@]}"; do
    if printf '%s\n' "$files" | grep -q "^${pkg}/"; then
      printf '%s\n' "$pkg"
    fi
  done
}

# How to run npm for a package: natively when its node_modules is present,
# otherwise through the compose service if that container happens to be up.
# Returning 1 means "no runtime available" - the caller warns and skips rather
# than blocking a commit on an environment the developer may not have set up.
runner_for() {
  local pkg="$1"
  if [ -d "${REPO_ROOT}/${pkg}/node_modules" ]; then
    printf 'host'
  elif docker compose -f "${REPO_ROOT}/compose.yml" ps --status running --services 2>/dev/null | grep -qx "$pkg"; then
    printf 'docker'
  else
    return 1
  fi
}

# run_script <package> <npm-script>  ->  exit status of that script
#
# Output is buffered and only replayed when the script fails. `npm run lint`
# is the same command CI runs, warnings and all, and the app currently carries
# 28 of them - printing that wall of text on every commit would bury the one
# line that actually matters.
run_script() {
  local pkg="$1" script="$2" runner status output
  if ! runner="$(runner_for "$pkg")"; then
    warn "skipping ${pkg} ${script}: no ${pkg}/node_modules and no running ${pkg} container"
    warn "  fix with: (cd ${pkg} && npm ci)   or: docker compose up -d ${pkg}"
    skipped=$((skipped + 1))
    return 0
  fi

  printf '%s\n' "${C_DIM}[${hook_name}]${C_OFF} ${pkg}: npm run ${script} ${C_DIM}(${runner})${C_OFF}"

  if [ "$runner" = "host" ]; then
    output="$(cd "${REPO_ROOT}/${pkg}" && npm run --silent "$script" 2>&1)"
    status=$?
  else
    output="$(docker compose -f "${REPO_ROOT}/compose.yml" exec -T "$pkg" npm run --silent "$script" 2>&1)"
    status=$?
  fi

  if [ "$status" -ne 0 ]; then
    printf '%s\n' "$output" >&2
  fi
  return "$status"
}

# run_all <label> <package...> -- <script...>
# Runs every script against every package, reporting all failures rather than
# stopping at the first: one round trip should surface everything CI would.
run_all() {
  local label="$1"; shift
  local -a pkgs=() scripts=()
  local seen_sep=0 arg
  for arg in "$@"; do
    if [ "$arg" = "--" ]; then seen_sep=1; continue; fi
    if [ "$seen_sep" -eq 0 ]; then pkgs+=("$arg"); else scripts+=("$arg"); fi
  done

  if [ "${#pkgs[@]}" -eq 0 ]; then
    log "no api/ or app/ changes - nothing to check"
    return 0
  fi

  local started failed=() pkg script ran=0
  skipped=0
  started=$(date +%s)

  for pkg in "${pkgs[@]}"; do
    for script in "${scripts[@]}"; do
      ran=$((ran + 1))
      if ! run_script "$pkg" "$script"; then
        failed+=("${pkg}:${script}")
      fi
    done
  done

  local elapsed=$(( $(date +%s) - started ))

  if [ "${#failed[@]}" -gt 0 ]; then
    fail ""
    fail "${label} failed after ${elapsed}s: ${failed[*]}"
    fail "CI runs the same commands, so this would fail there too."
    fail "Bypass with --no-verify if you know better."
    return 1
  fi

  # Never claim a pass for work that never ran - an unprepared environment
  # would otherwise look identical to a green one.
  if [ "$skipped" -eq "$ran" ]; then
    warn "${label} skipped entirely - nothing was verified"
    return 0
  fi

  if [ "$skipped" -gt 0 ]; then
    warn "${label} passed, but ${skipped} of ${ran} checks were skipped ${C_DIM}(${elapsed}s)${C_OFF}"
    return 0
  fi

  log "${C_GREEN}${label} passed${C_OFF} ${C_DIM}(${elapsed}s)${C_OFF}"
  return 0
}
