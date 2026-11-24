#!/usr/bin/env bash

# Preserve the existing Compose project and PostgreSQL volume names.
prod_shared_project() {
  local project
  project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$1" 2>/dev/null || true)
  if [[ $project =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
    printf '%s\n' "$project"
  else
    printf 'planner\n'
  fi
}

prod_shared_compose() {
  local project=$1
  shift
  PLANNER_POSTGRES_VOLUME="${project}_pgdata18" docker compose --project-name "$project" -f compose.prod.yml "$@"
}
