# Blue/Green Deploy — Tasks

## Compose restructure

- [ ] Add `router` service to `compose.prod.yml`: `nginx:1.31-alpine`, ports `127.0.0.1:8080:80`, networks `edge`+`backend`, mirror `app`'s hardening (read_only, tmpfs for `/var/cache/nginx` + `/var/run`, cap_drop/cap_add, security_opt, healthcheck on `http://127.0.0.1:80/`).
- [ ] Rename `app`/`api`/`migrate` container names to `planner-${COLOR}-{app,api,migrate}` (`COLOR` defaults to `blue`); keep `depends_on` ordering (`migrate` before `api`, postgres/redis healthy).
- [ ] Remove the `127.0.0.1:8080:80` host port publish from `app` (router owns it).
- [ ] Keep `postgres`/`redis`/secrets/volumes/networks exactly as-is (shared, never recreated).

## Router config

- [ ] Create `deploy/router.conf`: server block with `location /` → `proxy_pass http://app_active`, `location /api/` + `location /socket.io/` → `proxy_pass http://api_active`, with websocket upgrade headers copied from `.docker/app/nginx.conf`.
- [ ] Create `deploy/upstreams.active.conf` template defining `upstream app_active` + `upstream api_active` (bind-mounted at `/etc/nginx/conf.d/00-upstreams.conf` so it loads before the server block).
- [ ] Add `deploy/upstreams.active.conf` and `deploy/.active-color` to `.gitignore` (mutated at deploy time).

## API graceful shutdown

- [ ] Add SIGTERM/SIGINT handler in `api/src/index.ts`: log drain start, `httpServer.close()`, `closeIdleConnections()`, 10s force-exit fallback (`timer.unref()`), exit 0 on clean drain.
- [ ] Unit test: shutdown handler closes the server and exits cleanly (mock `close`/`process.exit`).

## Deploy script

- [ ] Create `scripts/blue-green-deploy.sh` (bash, `set -euo pipefail`), idempotent:
  - pulls images for `IMAGE_TAG=$sha`
  - reads `.active-color` (default `blue`), computes `NEXT`
  - `COLOR=$NEXT compose -f compose.prod.yml up -d migrate api app`
  - health-gate on `planner-$NEXT-api` via `docker exec ... wget http://localhost:4000/api/v1/health` (retry ~30 × 5s)
  - atomic `mv` of `upstreams.active.conf` → `docker exec planner-prod-router nginx -s reload` → write `.active-color`
  - teardown old color: `docker rm -f planner-$OLD-{migrate,api,app}` + `docker image prune -f`
  - bootstrap mode: if legacy `planner-prod-{app,api,migrate}` containers exist, remove them after the first successful switch.

## CI/CD

- [ ] Update `.github/workflows/deploy.yml` deploy step: `git pull --ff-only` + env setup + `bash scripts/blue-green-deploy.sh ${{ github.sha }}`; keep the public-URL verify step (optionally verify `/api/v1/health` through the router too).
- [ ] Keep build + scan jobs unchanged.

## Verification

- [ ] `docker compose -f compose.prod.yml config` renders both colors correctly and router upstreams reference the right container names.
- [ ] `npm run lint` + tests pass in `api/` (graceful shutdown) and `app/` (unchanged).
- [ ] Simulate locally: run `compose.prod.yml` with `COLOR=blue` then `COLOR=green`, switch router, confirm no failed requests during switch (e.g., a loop of `curl` through the router).
- [ ] Rollback drill: after a green switch, flip back to blue and confirm traffic follows.
- [ ] First production rollout (bootstrap): new green up → switch → legacy `planner-prod-*` removed → verify `https://planner.thiagobraga.dev` 200 + no 502s during deploy.
- [ ] Update README/AGENTS deploy section to document the blue/green flow + rollback runbook.