#!/usr/bin/env bash
# Sourced by the db-*.sh scripts for their --docker mode: runs the same script in a
# throwaway postgres client container that shares the prod server's network namespace.
# The client major version follows the server's server_version_num.

PG_CONTAINER=${PG_CONTAINER:-planner-prod-postgres}

db_docker_root() { cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd; }

db_secret() { docker exec "$PG_CONTAINER" cat "/run/secrets/$1"; }

# db_in_docker <script> [args...]: host paths under BACKUP_DIR are mapped to /backups.
db_in_docker() {
  local script=$1 root backup_dir user db pass num major tmp arg output status
  shift
  root=$(db_docker_root)
  backup_dir=${BACKUP_DIR:-$root/deploy/backups}
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  backup_dir=$(cd "$backup_dir" && pwd)
  user=$(db_secret postgres_user)
  db=$(db_secret postgres_db)
  num=$(docker exec "$PG_CONTAINER" psql -XAt -U "$user" -d "$db" -c 'SHOW server_version_num')
  if [[ ! $num =~ ^[0-9]{5,6}$ ]]; then
    echo "Could not read server_version_num from $PG_CONTAINER" >&2
    return 1
  fi
  major=$((num / 10000))
  echo "Server: $(docker exec "$PG_CONTAINER" psql -XAt -U "$user" -d "$db" -c 'SELECT version()')" >&2
  tmp=$(mktemp -d)
  chmod 700 "$tmp"
  pass=$(db_secret postgres_password)
  # .pgpass escapes ':' and '\' in fields.
  printf 'localhost:5432:*:%s:%s\n' "$(printf '%s' "$user" | sed 's/[\\:]/\\&/g')" \
    "$(printf '%s' "$pass" | sed 's/[\\:]/\\&/g')" > "$tmp/pgpass"
  unset pass
  chmod 600 "$tmp/pgpass"
  local -a mapped=()
  for arg in "$@"; do
    if [[ $arg == "$backup_dir"/* ]]; then arg="/backups/${arg#"$backup_dir"/}"; fi
    mapped+=("$arg")
  done
  status=0
  output=$(docker run --rm --network "container:$PG_CONTAINER" --user "$(id -u):$(id -g)" \
    -v "$root/scripts:/scripts:ro" -v "$backup_dir:/backups" -v "$tmp/pgpass:/pgpass:ro" \
    -e PGHOST=localhost -e PGPORT=5432 -e PGUSER="$user" -e PGDATABASE="$db" -e PGPASSFILE=/pgpass \
    -e BACKUP_DIR=/backups -e BACKUP_SHA -e BACKUP_RETENTION -e RESTORE_DB \
    "postgres:$major" bash "/scripts/$script" "${mapped[@]}") || status=$?
  rm -rf "$tmp"
  if [[ -n $output ]]; then printf '%s\n' "${output//\/backups\//$backup_dir/}"; fi
  return "$status"
}
