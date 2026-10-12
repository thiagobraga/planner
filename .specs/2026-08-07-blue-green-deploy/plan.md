# Blue/Green Deploy — Plan

## Context

Production hosts a single instance per service: `app` (nginx SPA + `/api` + `/socket.io` proxy), `api` (Express + Socket.IO), a one-shot `migrate`, and shared `postgres`/`redis`. `deploy.yml` SSHes to the VPS and runs `docker compose pull && up -d`, which **recreates** `app` and `api` (stop old → start new). During that window nothing listens on `127.0.0.1:8080` → 502s for seconds. The API also has no graceful shutdown, so in-flight requests are cut at teardown.

Goal: zero-downtime deploys, robust and simple, on the existing GitHub Actions + VPS + docker compose setup.

## Decisions (confirmed with user)

- **Approach:** Blue/Green behind a tiny stateless `nginx` router. The only "hot" process is the router; `app`/`api`/`migrate` run in two parallel colors. Host nginx (TLS terminator → `127.0.0.1:8080`) stays untouched after the one-time bootstrap.
- **Graceful shutdown:** add a SIGTERM/SIGINT drain to `api/src/index.ts`.

## Architecture

```
                        ┌-------------- router (stable, port 8080) --------------┐
                        │  / → app_active    /api, /socket.io → api_active       │
                        │  upstreams from a bind-mounted .active.conf file       │
                        └---------------┬-------------------------┬--------------┘
                     "blue"             │                         │            "green"
        planner-blue-app (old SPA)      │        planner-green-app (new SPA)  -┘
        planner-blue-api  (old API)     │        planner-green-api  (new API)
        planner-blue-migrate            │        planner-green-migrate
                                        └---------- postgres · redis (shared) ----
```

- **Router**: stock `nginx:1.31-alpine`, publishes `127.0.0.1:8080:80`, on `edge` + `backend` networks. Its entire `deploy/` config directory is mounted read-only. Switching = atomic `mv` to `deploy/00-upstreams.conf` + `nginx -s reload`, so the new file is visible inside the container. The router sends OAuth discovery, API and Socket.IO traffic directly to the active API.
- **Colors**: each color is its own Compose project (`planner-prod-blue` or `planner-prod-green`) from `compose.prod.color.yml`. This gives each color separate `app`/`api`/`migrate` service identities. Both attach to external `planner-prod-*` networks owned by `compose.prod.yml`, which keeps the existing PostgreSQL and Redis containers and volumes.
- `app` stops publishing a host port; only the router does. The deploy script waits for shared PostgreSQL and Redis, runs the inactive color's migration, then starts its API and app. The active color keeps serving during this work.

## Deploy flow

1. Pull the SHA-tagged images from GHCR and determine the inactive color from `deploy/.active-color`.
2. Start or reuse shared PostgreSQL and Redis without recreating them. Run migrations in the inactive project, then start its API and app and wait for both health checks.
3. **Switch**: atomically replace `deploy/00-upstreams.conf`, validate/reload the router, and verify the app and API through the public URL. On failure, restore the old config and keep the old color serving.
4. Record the active color and image SHA, then drain and stop the old color. Keep its image available for a later rollback with the previous SHA.

First rollout is a **bootstrap**: bring up the first color, then stop the legacy app to release port 8080, start the router, verify, and remove the legacy containers. Because both the legacy app and router must bind the same host port and host nginx stays unchanged, this first cutover has a brief unavoidable 502 window. Subsequent deployments keep the router bound and can switch without that port gap.

## Hard requirements / caveats

- **Migrations must stay backward-compatible** (additive). The old API serves the migrated schema for ~1–2 min during the switch; `DROP COLUMN`/`RENAME` would 500 on the old color during that window.
- **Socket.IO reconnect blip**: sockets live per-instance (no Redis adapter). At old-color teardown, tabs reconnect to the new color; offline queued mutations are covered by `offlineQueue`.
- **Graceful shutdown (recommended)**: SIGTERM/SIGINT → `server.close()` + `closeIdleConnections()`, 10s force-exit, so in-flight requests complete during drain.
- **Production readiness**: the API exits before listening if Redis/Socket.IO startup fails, and trusts the two controlled proxy hops (host nginx and router) when resolving the client IP for rate limits.
- PG/Redis config is unchanged; the script uses `--no-recreate` for these shared services.

## Files

- `compose.prod.yml` - shared `router`/PostgreSQL/Redis; `compose.prod.color.yml` - per-color `app`/`api`/`migrate`.
- `deploy/10-router.conf` (new) + `deploy/00-upstreams.conf` (new, runtime state).
- `scripts/blue-green-deploy.sh` (new).
- `.github/workflows/deploy.yml` — run the script; keep verify step.
- `api/src/index.ts` - graceful shutdown, sync startup gate, trusted proxy count (+ unit tests).
- `.gitignore` — runtime state files.
- README/AGENTS docs + `.specs` (this folder).
