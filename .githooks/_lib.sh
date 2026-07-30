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

# Which compose services are up. Resolved once per hook run: `docker compose ps`
# costs a few hundred ms and the answer cannot change mid-hook.
running_services_cache=""
running_services() {
  if [ -z "$running_services_cache" ]; then
    running_services_cache="$(docker compose -f "${REPO_ROOT}/compose.yml" ps --status running --services 2>/dev/null)"$'\n'
  fi
  printf '%s' "$running_services_cache"
}

# How to run npm for a package: through its compose service when that container
# is up, and only otherwise on the host.
#
# The container wins because compose.yml bind-mounts ./api and ./app straight in
# with no separate node_modules volume, so host and container share a single
# install - and it is the container that populates it. From an Alpine image that
# means musl native bindings, which a glibc host cannot load: vitest dies at
# startup on a missing @rolldown/binding-linux-x64-gnu before a single test runs.
# Preferring the host here made every push fail on an environment mismatch that
# had nothing to do with the diff.
#
# Returning 1 means "no runtime available" - the caller warns and skips rather
# than blocking a commit on an environment the developer may not have set up.
runner_for() {
  local pkg="$1"
  if running_services | grep -qx "$pkg"; then
    printf 'docker'
  elif [ -d "${REPO_ROOT}/${pkg}/node_modules" ]; then
    printf 'host'
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
    warn "skipping ${pkg} ${script}: no running ${pkg} container and no ${pkg}/node_modules"
    warn "  fix with: docker compose up -d ${pkg}   or: (cd ${pkg} && npm ci)"
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
