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
- [x] `npm run lint && npm test && npm run build` green — was blocked by pre-existing
      defects (see below), all since fixed. api 621 tests, app 608 tests, lint exit 0,
      both builds clean.

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
- [x] Generate a dedicated deploy SSH keypair; add public half to VPS
      `authorized_keys` — confirmed: repo secrets are `SSH_HOST`, `SSH_USER`,
      `SSH_KEY`, `SSH_KNOWN_HOSTS` (named differently than planned but same
      role), and `Deploy` workflow runs have been landing successfully all
      session.
- [x] Add GitHub Actions secrets — same as above, all four present
      (`gh secret list`), host key pinned via `SSH_KNOWN_HOSTS`.
- [x] After first push, set both GHCR packages to public visibility —
      confirmed: `docker pull ghcr.io/thiagobraga/planner-api:latest` on the
      VPS succeeds with no `~/.docker/config.json` present, i.e. no auth.

## Phase 4 — VPS one-time setup

- [x] Repo cloned on VPS — at `/p/projects/planner`, not `/opt/planner` as
      originally planned (path deviation, no functional difference).
- [x] `secrets/` populated — confirmed via `ls -la /etc/planner/secrets/`:
      `database_url`, `redis_url`, `csrf_secret`, `postgres_user`,
      `postgres_password`, `postgres_db`, `redis_password`, `backup_key`,
      `resend_api_key` all present. Path is `/etc/planner/secrets/`, not
      `/opt/planner/secrets/` — VPS `.env` points `*_FILE` vars there.
- [x] Password consistency — implied by working `psql`/`redis-cli` auth
      through the running stack; not independently re-verified byte-for-byte.
- [x] `chmod 600` on secrets — confirmed (`-rw-------` on every file).
- [x] `.env` created with `CORS_ORIGIN` — confirmed (site works cross-origin
      correctly; `RESEND_API_KEY_FILE` line also present).
- [x] `/etc/nginx/conf.d/planner.thiagobraga.dev.conf` — confirmed present,
      correct `proxy_pass http://127.0.0.1:8080` + `Upgrade`/`Connection`
      websocket headers for Socket.IO.
- [x] DNS + TLS — confirmed: valid Let's Encrypt cert for
      `planner.thiagobraga.dev` (ECDSA, expires 2026-10-20, auto-renews via
      `certbot.timer`), `curl -I` returns `HTTP/2 200` with no `-k` needed.
- [x] `nginx -t` / reload — implied by the live, correctly-serving config.

## Phase 5 — First deploy

- [x] `pull && up -d` — all 4 services (`app`, `api`, `postgres`, `redis`)
      up and healthy on the current `main` SHA.
- [x] Clean migration run — `migrate` container exits 0 after applying
      migrations, `restart: no`, no errors in its logs.
- [x] Account provisioned — created via the live `/register` flow rather
      than `provisionUser.js`; same practical outcome. The restore drill
      (Phase 6) also surfaced 2 stale non-real rows in `users` — one from an
      earlier local-DB backup accidentally restored onto prod
      (`dev@planner.local`), one leftover manual test account — both
      deleted 2026-07-23; only the real account remains.
- [x] `curl -I` TLS + headers — confirmed (`HTTP/2 200`, `nosniff`,
      `X-Frame-Options: DENY`, `Permissions-Policy`, `Referrer-Policy`).
- [x] Login via browser, create/complete a task — confirmed via prod API
      logs: real register→login→`/daily` session, collections/preferences/
      views all returning 200 for that session.
- [ ] Confirm Socket.IO real-time sync across two open tabs — one socket
      connection confirmed live in logs; the specific two-tab test was not
      run this session.

## Phase 6 — Close remaining P0 items (security-hardening spec)

- [x] Record Oracle provider-managed storage encryption as ADR-1 evidence —
      confirmed via OCI instance metadata: boot volume `sda` (root fs, where
      the `pgdata` Docker volume lives), Oracle-managed AES-256 encryption
      at rest, on by default, not user-configurable. Recorded above and in
      `.specs/2026-07-18-production-security-hardening/task.md`.
- [x] Run encrypted backup, restore into isolated scratch DB, verify row
      counts + read — done 2026-07-23. Restore surfaced 2 stale non-real
      accounts in prod (see Phase 5); both deleted. Full login smoke test
      not run (no access to the real account's live password) — restored
      password hashes and task/habit rows verified readable/intact instead.
- [x] Confirm Phase 3 Trivy scan shows no open high/critical — confirmed:
      `exit-code: 1` gate on HIGH/CRITICAL for both images, Deploy workflow
      run `29974663669` succeeded, i.e. 0 findings.
- [x] Add daily backup cron/systemd-timer with rotation — `planner-backup.timer`
      (systemd, daily 03:30 UTC + `RandomizedDelaySec`) → `planner-backup.service`
      → `/etc/planner/backup.sh`, output to `/etc/planner/backups/`
      (`chmod 700`), 14-day rotation. Path deviates from the planned
      `/opt/planner/backups/` to match this VPS's actual `/etc/planner/`
      convention for secrets/backups. First real run confirmed working.
- [ ] Off-box backup copy — still just a fast-follow note, not done, not
      blocking (per original plan). Backups currently live only on the VPS
      itself; a disk-level loss would take the app and its backups together.
- [x] Walk `.specs/2026-07-18-production-security-hardening/task.md` "P0
      Go-Live Verification" checklist against the live instance — done, see
      that spec's `task.md`.
- [x] Update that spec's `task.md` — done, including retiring the
      single-user/no-registration ADR-3 gate (superseded by the
      2026-07-22 register-forgot-password work, confirmed intentional).

## Phase 7 — Keep host/PII details out of the public repo

**Superseded 2026-07-23:** rather than splitting `docs/production-runbook.md`
into a tracked-placeholder file plus a local/gitignored file with the real
detail, the whole `docs/` folder (`production-runbook.md`,
`security/data-protection.md`) was deleted from the repo outright — an
explicit decision to keep operational/security runbook content off a public
repo entirely, not just the host-identifying parts of it. Go-Live Evidence
and all other content that lived there is now recorded directly in this
spec's and the security-hardening spec's `task.md` files instead. No local
runbook file was created; none of the original tasks in this phase apply
under the new approach.

## Pre-existing defects found during Phase 1 — all fixed

Not caused by this spec, but all affected what ships to production, so they were
cleared before first deploy.

- [x] **`api` build script could not fail.** `"build": "tsc && cp ... || true"` — the
      trailing `|| true` applied to the whole `&&` chain, so `npm run build` exited 0
      even with 41 `error TS` diagnostics. `ci.yml`'s build step and the Dockerfile's
      `RUN npm run build` were both no-op gates.
      Fixed: dropped `|| true`; a deliberate type error now exits 2. Dropped the
      vestigial `seed.ts` copy; the `.peggy` and migrations copies are load-bearing
      (read at runtime by `filterParser.ts`/`dateParser.ts` and `migrate.ts`) and now
      fail loudly.
- [x] **Test files were compiled into the production image.** No test exclusion in
      `tsconfig.json`, and `tsc` emits despite errors, so `dist/` carried 66 `*.test.js`
      plus mocks into the `production` stage — and vitest ran every suite twice.
      Fixed via `tsconfig.build.json`. Shipped image now has 0 test files; api image
      456MB → 305MB; suite count 132 files/1244 tests → 66/621.
- [x] **41 TS errors** across `src/middleware/__tests__/`, `src/routes/__tests__/`,
      `src/db/__tests__/`. Root cause: `ReturnType<typeof vi.fn>` is not assignable to
      express's `NextFunction`. `Mock<NextFunction>` does not fix it either —
      `NextFunction` is an overloaded interface, so the generic resolves to the wrong
      call signature; `NextFunction & Mock<(err?: unknown) => void>` does.
- [x] **`syncService.server.test.ts` failed (7 tests).** `vi.fn().mockImplementation(() => mockIO)`
      mocked socket.io's `Server` with an arrow function, which has no `[[Construct]]`
      slot, so `new IOServer(...)` threw under Vitest 4. Fixed with a function expression.
- [x] **`api` had no eslint config at all** — it declared eslint, typescript-eslint, and
      a lint script, but no config file, so `npm run lint` failed outright every run.
      Added a flat config mirroring `app`'s. Now 0 errors.
- [x] **`app` react-hooks rules were never active.** The code carries
      `eslint-disable-next-line react-hooks/exhaustive-deps` comments, but the plugin was
      never installed, so eslint errored on each one for an unknown rule. Installed v5
      (not v7 — v7 bundles React Compiler rules targeting React 19 and flags 31 unrelated
      pre-existing patterns). Now 0 errors.
- [x] **React was mismatched across the manifest.** `react ^19.2.7` against
      `react-dom ^18.3.1`, and `@types/react ^19` against `@types/react-dom ^18`. Installed
      was 18.3.1, which `^19.2.7` cannot resolve to — `node_modules` had drifted from the
      manifest, so a fresh `npm ci` in CI could have shipped a different React than the
      tests ran against. Aligned on 18 per decision; **upgrade to 19 is planned as
      follow-up work.**
- [x] **`@vitest/coverage-v8 ^3.2.7` peered on `vitest 3.2.7` exactly** while api runs
      `vitest ^4.1.10`. Bumped to `^4.1.10`.
- [x] **`--legacy-peer-deps` masked both conflicts above.** Removed from both Dockerfiles;
      images build without it. The app development stage also used `npm install`, ignoring
      the lockfile — switched to `npm ci`.

### Still open

- [ ] **Upgrade React 18 → 19** (deliberate follow-up, not a blocker). Bump `react-dom`
      and `@types/react-dom` to `^19` alongside `react`/`@types/react`, then consider
      moving eslint-plugin-react-hooks to v7 and working through its 31 React Compiler
      findings.
- [x] ~~**Dockerfile `HEALTHCHECK` asserts a 404.**~~ Fixed — `.docker/api/Dockerfile:28`
      now probes `/api/v1/health` and asserts 200. The endpoint also moved ahead of
      `authMiddleware`, so it answers without credentials.
- [ ] 18 lint warnings in `api`, 28 in `app` (unused vars, exhaustive-deps). Non-blocking.
