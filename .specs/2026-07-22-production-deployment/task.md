# Production Deployment — Oracle VPS (planner.thiagobraga.dev)

> Depends on `.specs/2026-07-18-production-security-hardening/` (code-level P0 work). This spec closes the infra-dependent P0 items and executes the actual rollout.

## Phase 1 — Code fixes

- [x] Remove dead `JWT_SECRET` from `api/src/config.ts` (lines 55-62)
- [x] Remove `JWT_SECRET`-specific test cases from `api/src/config.test.ts`
- [x] Remove incidental `process.env.JWT_SECRET = ...` boilerplate from other tests in that file
  - The two `readSecret` `_FILE` error-path tests were retargeted to `CSRF_SECRET_FILE`
    rather than deleted — they cover `readSecret`, not JWT, and deleting them would
    have dropped real coverage.
- [x] Remove now-dead `JWT_SECRET` from `compose.yml`, `ci.yml`, `CLAUDE.md`,
      `AGENTS.md`, `GEMINI.md`, `.claude/agents/test-runner.md` (not in original plan;
      leaving them would document a variable the code no longer reads)
- [x] Fix API healthcheck path in `compose.prod.yml` (`/health` → `/api/v1/health`)
- [x] `api/src/config.test.ts` passes (28/28)
- [ ] ~~`npm run lint && npm test && npm run build` green~~ — **blocked, pre-existing.**
      See "Pre-existing defects" below. Not caused by this spec's changes; verified
      identical on `main`.

## Phase 2 — `compose.prod.yml`: GHCR pull + host-nginx edge

- [x] `app` service: remove `traefik.*` labels
- [x] ~~`app` service: remove from `edge` network, keep only `backend`~~ — **plan was wrong.**
      Docker will not publish a host port for a container attached only to
      `internal: true` networks. Verified empirically: identical container on an
      internal network → connection refused; on a normal bridge → HTTP 200.
      `edge` is kept as a plain (non-Traefik) bridge to carry the published port.
- [x] `app` service: add `ports: ["127.0.0.1:8080:80"]`
- [x] `app` service: add `image: ghcr.io/thiagobraga/planner-app:${IMAGE_TAG:-latest}` (keep existing `build:`)
- [x] `api` service: add `image: ghcr.io/thiagobraga/planner-api:${IMAGE_TAG:-latest}`
- [x] `migrate` service: add matching `image:` field
- [x] ~~Remove unused `edge` network from top-level `networks:`~~ — kept, see above
- [x] `docker compose -f compose.prod.yml config` still validates cleanly

## Phase 3 — CI/CD: `.github/workflows/deploy.yml`

- [x] Add workflow triggered on push to `main` + `workflow_dispatch`
- [x] `permissions: packages: write`; login to `ghcr.io` with `GITHUB_TOKEN`
- [x] Build+push `planner-api` image (`target: production`, tags `:latest` + `:${{ github.sha }}`)
- [x] Build+push `planner-app` image (same pattern, via matrix)
- [x] Run Trivy scan against the pushed image refs; fail on high/critical
- [x] Fold the container scan into `deploy.yml`; remove `security.yml`'s stale job
  - Trade-off: container scanning no longer runs on pull requests, only on
    push-to-`main`. Repo-level Trivy secret scanning and CodeQL still run on PRs.
- [x] Add SSH deploy step (pins `IMAGE_TAG` to the built SHA, not `latest`, so the
      VPS deploys exactly what was scanned)
- [x] Post-deploy verification step: poll the public URL for HTTP 200, fail the job otherwise
- [ ] Generate a dedicated deploy SSH keypair (not personal key); add public half to VPS `authorized_keys` — **needs you**
- [ ] Add GitHub Actions secrets: `VPS_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY`, and
      `VPS_SSH_HOST_KEY` — **needs you**
  - `VPS_SSH_HOST_KEY` is an addition to the plan. Without a pinned host key the
    deploy step would need `StrictHostKeyChecking=no`, which accepts any key and
    leaves the deploy open to MITM. Get it with `ssh-keyscan -t ed25519 <host>`.
- [ ] After first push, set both GHCR packages to public visibility — **needs you**

## Phase 4 — VPS one-time setup

- [ ] `sudo mkdir -p /opt/planner && chown ubuntu:ubuntu` + `git clone` the repo there
- [ ] Generate `secrets/database_url`, `secrets/redis_url`, `secrets/csrf_secret`, `secrets/postgres_user`, `secrets/postgres_password`, `secrets/postgres_db`, `secrets/redis_password`, `secrets/backup_key`
- [ ] Verify `database_url`'s embedded password matches `postgres_password`; `redis_url`'s matches `redis_password`
- [ ] `chmod 600` everything under `secrets/`
- [ ] Create `/opt/planner/.env` with `CORS_ORIGIN=https://planner.thiagobraga.dev`
- [ ] Add `/etc/nginx/conf.d/planner.thiagobraga.dev.conf` (mirror `thiagobraga.dev.conf` pattern; `proxy_pass http://127.0.0.1:8080;` + websocket upgrade headers)
- [ ] Get VPS public IP (`curl -4 ifconfig.me`), add DNS A record `planner.thiagobraga.dev`
- [ ] `sudo certbot --nginx -d planner.thiagobraga.dev`
- [ ] `sudo nginx -t && sudo systemctl reload nginx`

## Phase 5 — First deploy

- [ ] `docker compose -f compose.prod.yml pull && up -d`
- [ ] Confirm clean migration run (`docker compose -f compose.prod.yml logs migrate`)
- [ ] Provision single account (`node dist/db/provisionUser.js --production --email <email> --password-stdin`)
- [ ] `curl -I https://planner.thiagobraga.dev` returns valid TLS + expected headers
- [ ] Log in via browser, create/complete a task
- [ ] Confirm Socket.IO real-time sync across two open tabs

## Phase 6 — Close remaining P0 items (security-hardening spec)

- [ ] Record Oracle provider-managed storage encryption as ADR-1 evidence
- [ ] Run encrypted backup, restore into isolated scratch DB, verify row counts + login read
- [ ] Confirm Phase 3 Trivy scan shows no open high/critical
- [ ] Add daily backup cron/systemd-timer with rotation into `/opt/planner/backups/`
- [ ] Note off-box backup copy as a fast-follow (not blocking)
- [ ] Walk `.specs/2026-07-18-production-security-hardening/task.md` "P0 Go-Live Verification" checklist against the live instance
- [ ] Update that spec's `task.md` to check off completed Phase 5/6 items

## Phase 7 — Keep host/PII details out of the public repo

- [ ] Create `docs/production-runbook.local.md`, add it to `.gitignore`
- [ ] Move real VPS IP and any personal incident contacts there
- [ ] `docs/production-runbook.md` keeps placeholders + a pointer to the local file
- [ ] Fill in the public runbook's Go-Live Evidence table with outcomes only, no host-identifying values

## Pre-existing defects found during Phase 1 (not caused by this spec)

Both affect what the production image contains. Neither is fixed here — they were
out of the planned scope and fixing them is its own piece of work.

- [ ] **`api` build script cannot fail.** `"build": "tsc && cp ... || true"` — the
      trailing `|| true` applies to the whole `&&` chain, so `npm run build` exits 0
      even when `tsc` reports errors. Confirmed: 41 `error TS` diagnostics, exit code 0.
      Consequence: `ci.yml`'s `npm run build` step and the Dockerfile's `RUN npm run build`
      are both no-op gates. Type regressions ship silently.
- [ ] **Test files are compiled into the production image.** `tsconfig.json` has
      `include: ["src/**/*"]` with no test exclusion, and `tsc` emits despite errors
      (`noEmitOnError` unset), so `dist/` contains 66 `*.test.js` files plus their
      `__tests__` fixtures and mocks. These are copied into the `production` stage.
      This is also why `npm test` runs each suite twice (once from `src/`, once from `dist/`).
      Fix: add `"exclude": ["**/*.test.ts", "**/__tests__/**"]` to a build-only tsconfig.
- [ ] **41 pre-existing TS errors** in `src/middleware/__tests__/` (30),
      `src/routes/__tests__/` (1), `src/db/__tests__/` (2), etc. Mostly Vitest `Mock`
      types not matching Express `NextFunction`. Must be cleared before the build gate
      above can be made real.
- [ ] **`npm run lint` is broken locally** — eslint reports an `.eslintrc`-to-flat-config
      migration error in the dev container. Same on `main`. Unverified whether CI hits it.
- [ ] **Dockerfile `HEALTHCHECK` asserts a 404.** `.docker/api/Dockerfile:28` probes
      `/health` and passes when the status is 404 — it only proves the process answers
      HTTP. `compose.prod.yml` overrides it, so this affects plain `docker run` only.
