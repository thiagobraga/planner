# Production Deployment — Oracle VPS (planner.thiagobraga.dev)

**Status:** Ready for implementation
**Priority:** Unblocks daily use of Planner across devices; first real production traffic
**Dependencies:** `.specs/2026-07-18-production-security-hardening/` (code-level P0 work, ~95% complete — this spec closes the remaining infra-dependent items and does the actual rollout)
**Estimated scope:** 2 small code fixes, `compose.prod.yml` edits, 1 new CI/CD workflow, VPS one-time setup (secrets, nginx vhost, DNS, certbot), first deploy, and the outstanding P0 evidence gathering (encryption, backup/restore, container scan)

## Outcome

Get Planner running in production at `https://planner.thiagobraga.dev`, publicly reachable, on Thiago's existing Oracle Cloud "Always Free" VPS (São Paulo), so it can be used from any device/network — not just at home — while the remaining feature work continues. Close out every still-open P0 item in the security-hardening spec that requires a live environment to verify.

## Context and Decisions

The security-hardening spec already implements opaque sessions, CSRF, CSP/security headers, offline-queue isolation, hardened Dockerfiles, and a hardened `compose.prod.yml`. What's missing is the rollout itself: nothing publishes images anywhere, and several P0 checklist items (storage-encryption evidence, backup/restore proof, container scan) can only be verified against a real deployment.

Target environment, decided in conversation with Thiago:

- **VPS, not a managed platform.** Already provisioned and free — no new infra to stand up.
- **Publicly exposed** at `planner.thiagobraga.dev`, not LAN-only.
- **Docker**, not bare-metal services. The alternative (installing Postgres/Redis natively, like the existing `thiagobraga.dev` static-site nginx setup) was considered and rejected: Docker's RAM overhead is tens of MB (shared kernel, not a VM), while `compose.prod.yml` already has real, tested isolation (read-only filesystems, `cap_drop`, network segmentation, non-root users, one-shot migration job) that would otherwise have to be rebuilt by hand for no meaningful resource savings.
- **No Traefik.** Confirmed via SSH: the VPS has 954MB RAM total and already runs native nginx + certbot serving `thiagobraga.dev` over TLS. Adding Traefik (+~70-80MB for the proxy and a second ACME stack) is redundant weight on a RAM-constrained box that already has a working TLS-terminating reverse proxy. The existing nginx gets a new vhost that reverse-proxies to the Planner app container over a loopback port instead.
- **CI/CD via GHCR.** GitHub Actions builds the `production` Docker targets, pushes to `ghcr.io/thiagobraga/planner-{api,app}`, and the VPS pulls + redeploys over SSH. No registry push currently exists in the repo (`ci.yml` and `security.yml` only build/test/scan locally).
- 2GB swap already configured on the VPS (done prior to this spec).

**Confirmed live on the VPS (via SSH):** Ubuntu 24.04, Docker 29.6.1 + Compose v5.2.0 already installed, `ubuntu` user is in the `docker` group (no `sudo` needed for compose), UFW already allows 22/80/443 (v4 and v6), 36GB disk free, no containers currently running, existing `thiagobraga.dev` cert issued via certbot's nginx plugin at `/etc/letsencrypt/live/thiagobraga.dev/`, vhost pattern lives at `/etc/nginx/conf.d/thiagobraga.dev.conf` (mirrored for the new subdomain).

### Two bugs found during exploration that block a clean production boot

1. `api/src/config.ts:55-62` still requires `JWT_SECRET` in production — `requireNonPlaceholder` throws if it's unset. JWT auth was fully replaced by opaque sessions; `jsonwebtoken` is not imported anywhere in the codebase anymore (confirmed via grep), and `compose.prod.yml` never provides `JWT_SECRET`. As shipped, the API would crash-loop on first production start. `.specs/2026-07-18-production-security-hardening/task.md` marks "Remove `JWT_SECRET` after session migration" as done — it wasn't.
2. `compose.prod.yml:58` healthchecks `http://localhost:4000/health`, but the route is mounted under `/api/v1` (`api/src/routes/index.ts:19`, `api/src/index.ts:130`) — the real path is `/api/v1/health`. The healthcheck fails permanently as written.

### Keeping host-identifying / personal details out of the public repo

`docs/production-runbook.md` is tracked in a **public** GitHub repo. Procedures, commands, and encryption/backup evidence are fine to publish — nothing here relies on obscurity. Two categories are not fine to publish:

- **The VPS's real public IP or any host-identifying detail** — publishing it turns a known resource-constrained box into an easy scan/DoS target.
- **Real incident-contact PII** (personal email/phone) — the runbook currently uses placeholder addresses (`infra@planner.app` etc.); they stay as placeholders in the tracked file.

Both live instead in a new `docs/production-runbook.local.md`, gitignored. The public runbook keeps generic placeholders plus a pointer: "see `docs/production-runbook.local.md` (not tracked) for host address and personal contacts." The Go-Live Evidence table in the public file records outcomes only ("restore verified, row counts matched"), never the IP the test ran against.

## Implementation Plan

### Phase 1 — Code fixes

- `api/src/config.ts`: delete the `JWT_SECRET` export/validation block.
- `api/src/config.test.ts`: remove the `JWT_SECRET`-specific test cases; audit the other tests that set `process.env.JWT_SECRET = ...` as incidental boilerplate and drop those lines too.
- `compose.prod.yml`: fix the API healthcheck to `http://localhost:4000/api/v1/health`.

### Phase 2 — `compose.prod.yml`: GHCR pull + host-nginx edge

- `app` service: drop the `traefik.*` labels and the `edge` network; add `ports: ["127.0.0.1:8080:80"]` and `image: ghcr.io/thiagobraga/planner-app:${IMAGE_TAG:-latest}` (keep the existing `build:` block — Compose uses `build` only when explicitly building, `image` for `pull`/plain `up`, so one file serves both CI and the VPS).
- `api` / `migrate` services: add `image: ghcr.io/thiagobraga/planner-api:${IMAGE_TAG:-latest}`.
- Remove the now-unused `edge` network from the top-level `networks:` block.

### Phase 3 — New CI/CD workflow: `.github/workflows/deploy.yml`

- Trigger: push to `main` (after `ci.yml` passes) + manual `workflow_dispatch`.
- `permissions: packages: write`; login to `ghcr.io` with `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}` (no extra PAT needed to push).
- Build+push both images (`docker/build-push-action`, `target: production`, tags `:latest` + `:${{ github.sha }}`) from `.docker/api/Dockerfile` and `.docker/app/Dockerfile`.
- Run Trivy against the just-built image refs — reuse the scan step from `security.yml`, which currently points at a stale local tag (`docker.io/library/planner-api:latest`); fix it to scan the real pushed tag. Fail the job on high/critical findings, per the security spec's existing acceptance criterion.
- After push+scan, SSH to the VPS (a freshly generated deploy keypair, not Thiago's personal key) and run:
  ```
  cd /opt/planner && git pull && \
  docker compose -f compose.prod.yml pull && \
  docker compose -f compose.prod.yml up -d && \
  docker image prune -f
  ```
- New GitHub Actions secrets: `VPS_HOST`, `VPS_SSH_USER=ubuntu`, `VPS_SSH_KEY`.
- After the first successful push, set both GHCR packages to **public** visibility (repo is already public; images contain no secrets) so the VPS needs no `docker login` to pull.

### Phase 4 — VPS one-time setup

- `sudo mkdir -p /opt/planner && sudo chown ubuntu:ubuntu /opt/planner && git clone https://github.com/thiagobraga/planner.git /opt/planner`.
- Generate secrets under `/opt/planner/secrets/` using the commands already in `docs/production-runbook.md`'s "Creating Secrets" section. **Care point:** the Postgres password embedded in `secrets/database_url` and the Redis password in `secrets/redis_url` must exactly match `secrets/postgres_password` and `secrets/redis_password` respectively — generate each password once and reuse it in both places.
- `/opt/planner/.env`: `CORS_ORIGIN=https://planner.thiagobraga.dev`.
- `chmod 600` everything under `secrets/`.
- New nginx vhost `/etc/nginx/conf.d/planner.thiagobraga.dev.conf`, mirroring the existing `thiagobraga.dev.conf` pattern (http→https redirect + ssl server block), but `proxy_pass http://127.0.0.1:8080;` instead of a static `root`, with `proxy_http_version 1.1` + `Upgrade`/`Connection` headers for Socket.IO and standard `X-Real-IP`/`X-Forwarded-*` headers.
- DNS: A record `planner.thiagobraga.dev` → VPS public IP at the `thiagobraga.dev` DNS provider. No new OCI Security List/firewall change needed — 80/443 are already open at both the OCI and UFW level (proven by the existing `thiagobraga.dev` site on the same host/ports).
- `sudo certbot --nginx -d planner.thiagobraga.dev` — a separate cert from the existing `thiagobraga.dev` one (no wildcard in use).

### Phase 5 — First deploy

- `cd /opt/planner && docker compose -f compose.prod.yml pull && docker compose -f compose.prod.yml up -d`.
- Check `docker compose -f compose.prod.yml logs migrate` for a clean migration run.
- Provision the single account: `docker compose -f compose.prod.yml exec api node dist/db/provisionUser.js --production --email <email> --password-stdin`.
- Smoke test: `curl -I https://planner.thiagobraga.dev`, then log in via browser, create/complete a task, confirm Socket.IO real-time sync across two open tabs.

### Phase 6 — Close remaining P0 items from the security spec

- **Storage encryption**: Oracle block/boot volumes are encrypted at rest by provider default — record as the ADR-1 "provider-managed encryption" evidence in the runbook's Go-Live table.
- **Backup/restore proof**: run the existing `pg_dump | openssl enc` backup command against the live DB (after the smoke-test task/habit exist), restore into a scratch Postgres container in isolation, verify row counts + a login read, record the result.
- **Container scan**: covered by the Phase 3 Trivy step — confirm no open high/critical.
- **Backup cadence**: daily cron/systemd-timer on the VPS running the backup command into `/opt/planner/backups/` with rotation. Backups on the same disk don't survive VPS loss — flagged as a fast-follow (off-box copy), not a blocker for first deploy.
- Walk the existing P0 Go-Live Verification checklist (`.specs/2026-07-18-production-security-hardening/task.md`, "P0 Go-Live Verification" section) against the live instance and check items off with evidence.
- Update that spec's `task.md` to mark the completed Phase 5/6 items and the P0 Go-Live checklist as done.

## Files Touched

- `api/src/config.ts`, `api/src/config.test.ts` — remove dead `JWT_SECRET`
- `compose.prod.yml` — image refs, healthcheck fix, drop Traefik/edge
- `.github/workflows/deploy.yml` — new
- `.github/workflows/security.yml` — fix Trivy image ref (or fold the scan into `deploy.yml`)
- `docs/production-runbook.md` — fill in Go-Live Evidence rows (outcomes only), record the nginx-as-edge decision, point to the local file for host/contact specifics
- New, gitignored: `docs/production-runbook.local.md` — real VPS IP and personal incident contacts; add the entry to `.gitignore`
- `.specs/2026-07-18-production-security-hardening/task.md` — check off completed Phase 5/6 items with evidence
- VPS-side, not in git: `/opt/planner/secrets/*`, `/opt/planner/.env`, `/etc/nginx/conf.d/planner.thiagobraga.dev.conf`

## Verification

- `cd api && npm run lint && npm test && npm run build` and the same for `app` — must stay green after the `JWT_SECRET` removal.
- `docker compose -f compose.prod.yml config` succeeds with real secrets present, fails when any required one is omitted.
- Live: `curl -I https://planner.thiagobraga.dev` shows a valid cert and expected security headers (HSTS, CSP, etc.).
- Browser: log in with the provisioned account, create/complete a task, confirm sync across two open tabs.
- Cookie inspection: `__Host-planner_session` present with `Secure; HttpOnly; SameSite=Strict; Path=/`, no `Domain`.
- `curl` an unsafe route without the CSRF header → expect `403`.
- Restore drill: row counts on the restored scratch DB match the source.
- `free -h` and `docker stats` on the VPS after the full stack is up, under normal use — confirm no swap thrashing or OOM in `dmesg`.
