# Blue/Green Deploy — Plan

## Context

Production hosts a single instance per service: `app` (nginx SPA + `/api` + `/socket.io` proxy), `api` (Express + Socket.IO), a one-shot `migrate`, and shared `postgres`/`redis`. `deploy.yml` SSHes to the VPS and runs `docker compose pull && up -d`, which **recreates** `app` and `api` (stop old → start new). During that window nothing listens on `127.0.0.1:8080` → 502s for seconds. The API also has no graceful shutdown, so in-flight requests are cut at teardown.

Goal: zero-downtime deploys, robust and simple, on the existing GitHub Actions + VPS + docker compose setup.

## Decisions (confirmed with user)

- **Approach:** Blue/Green behind a tiny stateless `nginx` router. The only "hot" process is the router; `app`/`api`/`migrate` run in two parallel colors. Host nginx (TLS terminator → `127.0.0.1:8080`) stays untouched.
- **Graceful shutdown:** add a SIGTERM/SIGINT drain to `api/src/index.ts`.

## Architecture

```
                        ┌────────────── router (stable, port 8080) ──────────────┐
                        │  / → app_active    /api, /socket.io → api_active       │
                        │  upstreams from a bind-mounted .active.conf file        │
                        └───────────────┬─────────────────────────┬──────────────┘
                     "blue"             │                         │            "green"
        planner-blue-app (old SPA)      │        planner-green-app (new SPA)  ─┘
        planner-blue-api  (old API)     │        planner-green-api  (new API)
        planner-blue-migrate            │        planner-green-migrate
                                        └────────── postgres · redis (shared) ────
```

- **Router**: stock `nginx:1.31-alpine`, publishes `127.0.0.1:8080:80`, on `edge` + `backend` networks. Never rebuilt; its image never changes. The two `upstream` blocks are bind-mounted from a host file (`deploy/upstreams.active.conf` → `/etc/nginx/conf.d/00-upstreams.conf`, sorted before the server block). Switching = atomic `mv` of that file + `nginx -s reload`, which finishes in-flight requests on old workers while new connections take the new active color.
- **Colors**: `app`, `api`, `migrate` get `${COLOR}`-suffixed container names (`planner-{blue|green}-{app,api,migrate}`). Both colors attach to the existing shared `backend`/`data`/`egress` networks and point at the same PG + Redis (unchanged, never recreated).
- `app` stops publishing a host port; only the router does. `migrate` keeps `depends_on: postgres: service_healthy` and `api` keeps `depends_on: migrate: service_completed_successfully` — so in a fresh color, migrations apply before the new API serves, while the old color keeps serving.

## Deploy flow

1. Pull new images (`latest` + `$sha` from GHCR).
2. Determine color: read `deploy/.active-color`; `NEXT` = the other one.
3. `COLOR=$NEXT compose -f compose.prod.yml up -d migrate api app` — new color boots beside the active one.
4. Health-gate: `docker exec planner-$NEXT-api wget -qO- http://localhost:4000/api/v1/health` until 200 (no published port → unreachable from outside until switched).
5. **Switch**: write `deploy/upstreams.active.conf` (atomic `mv`) → `docker exec planner-prod-router nginx -s reload` → update `.active-color`.
6. Verify via public URL (`https://planner.thiagobraga.dev`), then teardown old color: `docker rm -f planner-$OLD-{migrate,api,app}` + `docker image prune -f`.
7. **Rollback**: before teardown (or after, by re-starting the old color) flip the file back + reload. Old color is warm until torn down.

First rollout is a **bootstrap**: bring up the first color, switch, then remove the legacy `planner-prod-{app,api,migrate}` containers.

## Hard requirements / caveats

- **Migrations must stay backward-compatible** (additive). The old API serves the migrated schema for ~1–2 min during the switch; `DROP COLUMN`/`RENAME` would 500 on the old color during that window.
- **Socket.IO reconnect blip**: sockets live per-instance (no Redis adapter). At old-color teardown, tabs drop + auto-reconnect to the new color in ~1s; offline queued mutations are covered by `offlineQueue`.
- **Graceful shutdown (recommended)**: SIGTERM/SIGINT → `server.close()` + `closeIdleConnections()`, 10s force-exit, so in-flight requests complete during drain.
- PG/Redis config is unchanged → `docker compose up -d` never recreates them.

## Files

- `compose.prod.yml` — add `router`; suffix `app`/`api`/`migrate` names with `${COLOR}`; drop `app` fast path publishing.
- `deploy/router.conf` (new) + `deploy/upstreams.active.conf` (new, runtime state).
- `scripts/blue-green-deploy.sh` (new).
- `.github/workflows/deploy.yml` — run the script; keep verify step.
- `api/src/index.ts` — graceful shutdown (+ unit test).
- `.gitignore` — runtime state files.
- README/AGENTS docs + `.specs` (this folder).