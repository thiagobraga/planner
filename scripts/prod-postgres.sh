#!/usr/bin/env bash

# Both deploy and upgrade resolve the same Compose project and volume names.
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
  local project=$1 major=$2
  shift 2
  local -a files=(-f compose.prod.yml)
  if [[ $major == 16 ]]; then files+=(-f compose.prod.pg16.yml); fi
  PLANNER_POSTGRES_VOLUME="${project}_pgdata18" docker compose --project-name "$project" "${files[@]}" "$@"
}
