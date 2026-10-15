#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_ROOT=$(mktemp -d)
trap 'rm -rf "$TEMP_ROOT"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_contains() { grep -Fq -- "$1" "$2" || fail "Missing '$1' in $2"; }
assert_not_contains() { ! grep -Fq -- "$1" "$2" || fail "Unexpected '$1' in $2"; }

mkdir -p "$TEMP_ROOT/bin"
cat > "$TEMP_ROOT/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$MOCK_LOG"
case "$1" in
  compose)
    if [[ $* == *' run --rm --no-deps -T network-init' ]]; then
      touch "$CASE_ROOT/network-planner-prod-backend" "$CASE_ROOT/network-planner-prod-egress"
    fi
    if [[ ${MOCK_REQUIRE_NETWORKS:-0} == 1 && $* == *' up -d --no-deps api' ]]; then
      [[ -f "$CASE_ROOT/network-planner-prod-backend" && -f "$CASE_ROOT/network-planner-prod-egress" ]] || exit 1
    fi
    ;;
  inspect)
    if [[ $3 == *com.docker.compose.project* ]]; then
      if [[ -n ${MOCK_SHARED_PROJECT:-} ]]; then echo "$MOCK_SHARED_PROJECT"; else exit 1; fi
    elif [[ $3 == '{{.State.Health.Status}}' ]]; then
      if [[ ${MOCK_FAIL_SHARED:-0} == 1 && ${*: -1} == planner-prod-redis ]]; then
        echo unhealthy
      else
        echo healthy
      fi
    elif [[ ${*: -1} == planner-prod-app && ${MOCK_LEGACY:-0} == 1 ]]; then
      echo true
    elif [[ ${*: -1} == planner-blue-* || ${*: -1} == planner-green-* ]]; then
      echo true
    else
      exit 1
    fi
    ;;
  wait)
    if [[ ${MOCK_FAIL_MIGRATION:-0} == 1 ]]; then echo 1; else echo 0; fi
    ;;
  exec)
    if [[ ${MOCK_FAIL_HEALTH:-0} == 1 && $2 == planner-green-api && $3 == wget ]]; then exit 1; fi
    ;;
esac
MOCK
cat > "$TEMP_ROOT/bin/curl" <<'MOCK'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
[[ ${MOCK_FAIL_PUBLIC:-0} != 1 ]] || exit 1
for ((i=1; i<=$#; i++)); do
  if [[ ${!i} == --dump-header ]]; then
    j=$((i+1))
    color=${MOCK_STALE_COLOR:-$(sed -n 's/.*default \(blue\|green\);.*/\1/p' "$CASE_ROOT/deploy/00-upstreams.conf")}
    printf 'HTTP/1.1 200 OK\r\nX-Planner-Color: %s\r\n' "$color" > "${!j}"
  fi
done
MOCK
cat > "$TEMP_ROOT/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$TEMP_ROOT/bin/"*

setup_case() {
  CASE_ROOT="$TEMP_ROOT/$1"
  mkdir -p "$CASE_ROOT/scripts" "$CASE_ROOT/deploy"
  cp "$SCRIPT_DIR/blue-green-deploy.sh" "$CASE_ROOT/scripts/"
  touch "$CASE_ROOT/compose.prod.yml" "$CASE_ROOT/compose.prod.color.yml"
  printf 'server {}\n' > "$CASE_ROOT/deploy/10-router.conf"
  export MOCK_LOG="$CASE_ROOT/commands.log"
  export CASE_ROOT
  : > "$MOCK_LOG"
  unset MOCK_LEGACY MOCK_FAIL_HEALTH MOCK_FAIL_PUBLIC MOCK_STALE_COLOR MOCK_FAIL_SHARED MOCK_FAIL_MIGRATION MOCK_SHARED_PROJECT MOCK_REQUIRE_NETWORKS PUBLIC_URL || true
}

run_deploy() {
  CORS_ORIGIN=https://planner.example.test PATH="$TEMP_ROOT/bin:$PATH" bash "$CASE_ROOT/scripts/blue-green-deploy.sh" \
    0123456789abcdef0123456789abcdef01234567 > "$CASE_ROOT/output.log" 2>&1
}

setup_case normal
echo blue > "$CASE_ROOT/deploy/.active-color"
echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa > "$CASE_ROOT/deploy/.active-image"
export MOCK_SHARED_PROJECT=planner-production
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
run_deploy || fail "Normal deployment failed"
assert_contains 'docker compose --project-name planner-production -f compose.prod.yml up -d --no-recreate postgres redis' "$MOCK_LOG"
[[ $(<"$CASE_ROOT/deploy/.active-color") == green ]] || fail "Active color was not committed"
[[ $(<"$CASE_ROOT/deploy/.previous-image") == aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ]] || fail "Previous image was not recorded"
[[ $(<"$CASE_ROOT/deploy/.active-image") == 0123456789abcdef0123456789abcdef01234567 ]] || fail "Active image was not recorded"
assert_contains 'planner-green-app:80' "$CASE_ROOT/deploy/00-upstreams.conf"
assert_contains 'default green;' "$CASE_ROOT/deploy/00-upstreams.conf"
assert_contains 'docker exec planner-prod-router nginx -s reload' "$MOCK_LOG"
assert_contains 'docker stop -t 15 planner-blue-api' "$MOCK_LOG"
assert_contains 'curl --fail --silent --show-error --max-time 5 --dump-header' "$MOCK_LOG"
assert_contains 'https://planner.example.test/api/v1/health' "$MOCK_LOG"
api_start=$(grep -n 'up -d --no-deps api$' "$MOCK_LOG" | head -1 | cut -d: -f1)
app_start=$(grep -n 'up -d --no-deps app$' "$MOCK_LOG" | head -1 | cut -d: -f1)
[[ $api_start -lt $app_start ]] || fail "App started before its API"
verify_line=$(grep -n 'curl .*api/v1/health' "$MOCK_LOG" | tail -1 | cut -d: -f1)
stop_line=$(grep -n 'docker stop -t 15 planner-blue-app' "$MOCK_LOG" | head -1 | cut -d: -f1)
(( verify_line < stop_line )) || fail "Old color stopped before public verification"

setup_case health_failure
echo blue > "$CASE_ROOT/deploy/.active-color"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_FAIL_HEALTH=1
if run_deploy; then fail "Unhealthy API was accepted"; fi
[[ $(<"$CASE_ROOT/deploy/.active-color") == blue ]] || fail "Health failure changed active color"
assert_not_contains 'nginx -s reload' "$MOCK_LOG"

setup_case migration_failure
echo blue > "$CASE_ROOT/deploy/.active-color"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_FAIL_MIGRATION=1
if run_deploy; then fail "Failed migration was accepted"; fi
assert_not_contains 'compose.prod.color.yml up -d --no-deps api app' "$MOCK_LOG"
assert_not_contains 'nginx -s reload' "$MOCK_LOG"
assert_not_contains 'docker stop -t 15 planner-blue' "$MOCK_LOG"

setup_case shared_failure
echo blue > "$CASE_ROOT/deploy/.active-color"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_FAIL_SHARED=1
if run_deploy; then fail "Unhealthy shared Redis was accepted"; fi
assert_not_contains 'compose.prod.color.yml pull' "$MOCK_LOG"
assert_not_contains 'nginx -s reload' "$MOCK_LOG"

setup_case invalid_project_label
echo blue > "$CASE_ROOT/deploy/.active-color"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_SHARED_PROJECT='not a project'
run_deploy || fail "Fallback shared project failed"
assert_contains 'docker compose --project-name planner -f compose.prod.yml up -d --no-recreate postgres redis' "$MOCK_LOG"

setup_case switch_failure
echo blue > "$CASE_ROOT/deploy/.active-color"
echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa > "$CASE_ROOT/deploy/.active-image"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_FAIL_PUBLIC=1
if run_deploy; then fail "Failed public verification was accepted"; fi
[[ $(<"$CASE_ROOT/deploy/.active-color") == blue ]] || fail "Failed switch committed active color"
[[ $(<"$CASE_ROOT/deploy/.active-image") == aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ]] || fail "Failed switch changed active image"
assert_contains 'planner-blue-app:80' "$CASE_ROOT/deploy/00-upstreams.conf"
[[ $(grep -Fc 'nginx -s reload' "$MOCK_LOG") == 2 ]] || fail "Expected switch and rollback reloads"
assert_not_contains 'docker stop -t 15 planner-blue' "$MOCK_LOG"

setup_case stale_router
echo blue > "$CASE_ROOT/deploy/.active-color"
printf 'upstream app_active { server planner-blue-app:80; }\n' > "$CASE_ROOT/deploy/00-upstreams.conf"
export MOCK_STALE_COLOR=blue
if run_deploy; then fail "Router serving old color was accepted"; fi
[[ $(<"$CASE_ROOT/deploy/.active-color") == blue ]] || fail "Stale router changed active color"
assert_not_contains 'docker stop -t 15 planner-blue' "$MOCK_LOG"

setup_case bootstrap_failure
export MOCK_LEGACY=1 MOCK_FAIL_PUBLIC=1
if run_deploy; then fail "Failed bootstrap was accepted"; fi
[[ ! -e "$CASE_ROOT/deploy/.active-color" ]] || fail "Failed bootstrap committed active color"
assert_contains 'docker stop -t 15 planner-prod-app' "$MOCK_LOG"
assert_contains 'docker start planner-prod-app' "$MOCK_LOG"
assert_contains 'docker compose --project-name planner -f compose.prod.yml stop router' "$MOCK_LOG"

setup_case bootstrap_success
export MOCK_LEGACY=1
run_deploy || fail "Bootstrap failed"
[[ $(<"$CASE_ROOT/deploy/.active-color") == blue ]] || fail "Bootstrap did not activate blue"
[[ ! -e "$CASE_ROOT/deploy/.previous-image" ]] || fail "Bootstrap invented a previous image"
assert_contains 'docker stop -t 15 planner-prod-app' "$MOCK_LOG"
assert_contains 'docker rm planner-prod-api' "$MOCK_LOG"

setup_case fresh_host
export MOCK_REQUIRE_NETWORKS=1
run_deploy || fail "Fresh host could not start a color with its required networks"
assert_contains 'docker compose --project-name planner -f compose.prod.yml run --rm --no-deps -T network-init' "$MOCK_LOG"
network_init=$(grep -n 'run --rm --no-deps -T network-init' "$MOCK_LOG" | head -1 | cut -d: -f1)
api_start=$(grep -n 'up -d --no-deps api$' "$MOCK_LOG" | head -1 | cut -d: -f1)
(( network_init < api_start )) || fail "Networks were initialized after API startup"
[[ $(<"$CASE_ROOT/deploy/.active-color") == blue ]] || fail "Fresh host did not activate blue"

setup_case missing_origin
if env -u CORS_ORIGIN -u PUBLIC_URL PATH="$TEMP_ROOT/bin:$PATH" bash "$CASE_ROOT/scripts/blue-green-deploy.sh" \
  0123456789abcdef0123456789abcdef01234567 > "$CASE_ROOT/output.log" 2>&1; then
  fail "Deploy without a verification origin was accepted"
fi
assert_contains 'Set PUBLIC_URL or CORS_ORIGIN' "$CASE_ROOT/output.log"
[[ ! -s "$MOCK_LOG" ]] || fail "Deploy without a verification origin touched Docker"

echo 'blue-green-deploy: 11 scenarios passed'
