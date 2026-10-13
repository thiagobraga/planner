# Blue/Green Deploy - Tasks

## 1. Separate shared and color services

- [x] Keep PostgreSQL, Redis, volumes, and named networks in `compose.prod.yml`; add the hardened router on port 8080 and initialize backend/egress networks before first color startup.
- [x] Move app, API, and migration into `compose.prod.color.yml` on shared external networks. Use a separate Compose project per color so the inactive `up` cannot recreate active services.
- [x] Remove the app's host port and gate API startup on its color's migration.
- [x] Render and inspect both color configurations with `docker compose config`.

## 2. Route and switch traffic

- [x] Add `deploy/10-router.conf` for app, API, OAuth discovery, and Socket.IO, preserving forwarded HTTPS and WebSocket upgrade headers.
- [x] Mount the `deploy/` directory so atomic replacement of `deploy/00-upstreams.conf` is visible inside nginx.
- [x] Emit an `X-Planner-Color` response header and verify it after each public switch.
- [x] Ignore runtime color, image, lock, and upstream files in `.gitignore`.

## 3. Drain API requests

- [x] Add idempotent SIGTERM/SIGINT shutdown in `api/src/index.ts` with a 10-second limit.
- [x] Cover clean drain, duplicate signal, and timeout behavior in `api/src/__tests__/index.test.ts`.

## 4. Deploy and roll back

- [x] Add `scripts/blue-green-deploy.sh` with `flock`, SHA-tagged pulls, shared service health checks, migration gate, and inactive API/app health gates.
- [x] Validate/reload nginx, verify public app and API route identity, then atomically record the active color and SHA.
- [x] On switch failure restore the old upstream; after success allow old requests to drain before stopping the old color.
- [x] Preserve the prior image SHA for post-deploy rollback by rerunning the script.
- [x] Handle one-time legacy bootstrap on occupied port 8080, with restart of the legacy app if verification fails.
- [x] Cover deploy, failed gates, rollback, stale router, and bootstrap in shell tests.

## 5. Integrate and validate

- [x] Update `.github/workflows/4.deploy.yml` to validate the script and Compose configs, then run the script after build, scan, and promotion jobs.
- [x] Document operation, rollback, backward-compatible migration requirement, and bootstrap port handoff in README and AGENTS.
- [x] Test stock nginx syntax and a live mock blue-to-green switch and rollback: 600 requests per direction, zero failed or misrouted responses.
- [x] Complete API/app lint, tests, builds, and diff checks in the isolated worktree. API: 1046 tests; app: 1311 tests on rerun, 38 lint warnings and 0 errors.
- [ ] First production rollout and public verification. This is outside the PR implementation; run only after review and merge.
