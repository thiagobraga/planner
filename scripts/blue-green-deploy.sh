#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! $1 =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "Usage: $0 <40-character commit SHA>" >&2
  exit 2
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEPLOY_DIR="$ROOT_DIR/deploy"
UPSTREAM_FILE="$DEPLOY_DIR/00-upstreams.conf"
STATE_FILE="$DEPLOY_DIR/.active-color"
IMAGE_FILE="$DEPLOY_DIR/.active-image"
PREVIOUS_IMAGE_FILE="$DEPLOY_DIR/.previous-image"
PUBLIC_URL=${PUBLIC_URL:-${CORS_ORIGIN:-}}
if [[ -z $PUBLIC_URL ]]; then
  echo "Set PUBLIC_URL or CORS_ORIGIN to verify the deployed host" >&2
  exit 2
fi
PUBLIC_URL=${PUBLIC_URL%/}
export IMAGE_TAG=$1

mkdir -p "$DEPLOY_DIR"
cd "$ROOT_DIR"
exec 9>"$DEPLOY_DIR/.deploy.lock"
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }

shared_project=planner
existing_project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' planner-prod-postgres 2>/dev/null || true)
if [[ $existing_project =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  shared_project=$existing_project
fi

shared_compose() {
  docker compose --project-name "$shared_project" -f compose.prod.yml "$@"
}

color_compose() {
  COLOR=$1 docker compose --project-name "planner-prod-$1" -f compose.prod.color.yml "${@:2}"
}

is_running() {
  [[ $(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true) == true ]]
}

write_upstreams() {
  local color=$1 tmp
  tmp=$(mktemp "$UPSTREAM_FILE.XXXXXX")
  {
    printf 'upstream app_active { server planner-%s-app:80; }\n' "$color"
    printf 'upstream api_active { server planner-%s-api:4000; }\n' "$color"
    printf 'map $host $planner_active_color { default %s; }\n' "$color"
  } > "$tmp"
  chmod 644 "$tmp"
  mv -f "$tmp" "$UPSTREAM_FILE"
}

write_state() {
  local file=$1 value=$2 tmp
  tmp=$(mktemp "$file.XXXXXX")
  printf '%s\n' "$value" > "$tmp"
  mv -f "$tmp" "$file"
}

wait_for_health() {
  local container=$1 url=$2 attempt
  for attempt in $(seq 1 30); do
    if docker exec "$container" wget -qO- "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  echo "Health check failed: $container $url" >&2
  return 1
}

wait_for_container_health() {
  local container=$1 attempt
  for attempt in $(seq 1 30); do
    if [[ $(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true) == healthy ]]; then
      return 0
    fi
    sleep 5
  done
  echo "Container did not become healthy: $container" >&2
  return 1
}

verify_public() {
  local color=$1 attempt headers
  headers=$(mktemp)
  for attempt in $(seq 1 10); do
    if curl --fail --silent --show-error --max-time 5 --dump-header "$headers" --output /dev/null "$PUBLIC_URL/" 2>/dev/null &&
       tr -d '\r' < "$headers" | grep -iqE "^X-Planner-Color:[[:space:]]*$color[[:space:]]*$" &&
       curl --fail --silent --show-error --max-time 5 --dump-header "$headers" --output /dev/null "$PUBLIC_URL/api/v1/health" 2>/dev/null &&
       tr -d '\r' < "$headers" | grep -iqE "^X-Planner-Color:[[:space:]]*$color[[:space:]]*$"; then
      rm -f "$headers"
      return 0
    fi
    sleep 5
  done
  rm -f "$headers"
  echo "Public verification failed: $PUBLIC_URL" >&2
  return 1
}

active=''
previous_image=''
previous_previous_image=''
if [[ -f $IMAGE_FILE ]]; then previous_image=$(<"$IMAGE_FILE"); fi
if [[ -f $PREVIOUS_IMAGE_FILE ]]; then previous_previous_image=$(<"$PREVIOUS_IMAGE_FILE"); fi
if [[ -f $STATE_FILE ]]; then
  active=$(<"$STATE_FILE")
  if [[ $active != blue && $active != green ]]; then
    echo "Invalid active color: $active" >&2
    exit 1
  fi
  if [[ ! -f $UPSTREAM_FILE ]]; then
    echo "Missing active upstream config: $UPSTREAM_FILE" >&2
    exit 1
  fi
fi

next=blue
if [[ $active == blue ]]; then next=green; fi
legacy=false
if [[ -z $active ]] && is_running planner-prod-app; then legacy=true; fi
legacy_stopped=false
switch_started=false

rollback() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    echo "Deployment failed; restoring previous traffic" >&2
    if [[ $switch_started == true ]]; then
      if [[ -n $active ]]; then
        write_upstreams "$active"
        docker exec planner-prod-router nginx -s reload || true
        verify_public "$active" || echo "Rollback public verification failed" >&2
      elif [[ $legacy_stopped == true ]]; then
        shared_compose stop router || true
        docker start planner-prod-app || true
      else
        shared_compose stop router || true
      fi
      if [[ -n $previous_image ]]; then
        write_state "$IMAGE_FILE" "$previous_image"
      else
        rm -f "$IMAGE_FILE"
      fi
      if [[ -n $previous_previous_image ]]; then
        write_state "$PREVIOUS_IMAGE_FILE" "$previous_previous_image"
      else
        rm -f "$PREVIOUS_IMAGE_FILE"
      fi
    fi
  fi
  exit "$status"
}
trap rollback EXIT

echo "Deploying $IMAGE_TAG to $next"
shared_compose run --rm --no-deps -T network-init
shared_compose up -d --no-recreate postgres redis
wait_for_container_health planner-prod-postgres
wait_for_container_health planner-prod-redis
color_compose "$next" pull api app
color_compose "$next" up -d --no-deps --force-recreate migrate
migration_exit=$(timeout 180 docker wait "planner-$next-migrate")
if [[ $migration_exit != 0 ]]; then
  echo "Migration failed with exit code $migration_exit" >&2
  exit 1
fi

color_compose "$next" up -d --no-deps api
wait_for_health "planner-$next-api" http://127.0.0.1:4000/api/v1/health
color_compose "$next" up -d --no-deps app
wait_for_health "planner-$next-app" http://127.0.0.1:80/

switch_started=true
write_upstreams "$next"
if [[ $legacy == true ]]; then
  # The legacy app owns 8080, so the first router start has a brief gap.
  docker stop -t 15 planner-prod-app
  legacy_stopped=true
  shared_compose up -d --no-deps router
elif [[ -z $active ]]; then
  shared_compose up -d --no-deps router
else
  docker exec planner-prod-router nginx -t
  docker exec planner-prod-router nginx -s reload
fi

verify_public "$next"
if [[ -n $previous_image ]]; then
  write_state "$PREVIOUS_IMAGE_FILE" "$previous_image"
else
  rm -f "$PREVIOUS_IMAGE_FILE"
fi
write_state "$IMAGE_FILE" "$IMAGE_TAG"
write_state "$STATE_FILE" "$next"
trap - EXIT

# Nginx's old workers keep in-flight requests while their connections drain.
# Give those requests time to finish before stopping the previous containers.
sleep "${DRAIN_SECONDS:-15}"

if [[ -n $active ]]; then
  for service in app api migrate; do
    if is_running "planner-$active-$service"; then
      docker stop -t 15 "planner-$active-$service"
    fi
    docker rm "planner-$active-$service" >/dev/null 2>&1 || true
  done
elif [[ $legacy == true ]]; then
  for service in app api migrate; do
    if is_running "planner-prod-$service"; then
      docker stop -t 15 "planner-prod-$service"
    fi
    docker rm "planner-prod-$service" >/dev/null 2>&1 || true
  done
fi

docker image prune -f >/dev/null
echo "Deployment complete: $next ($IMAGE_TAG)"
