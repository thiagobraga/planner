# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[n]` decided not to do.

1. [x] Spec (`plan.md`, this file)
2. [x] Names and order
   - [x] Files and names numbered `1.review`, `2.ci`, `2a.quality`, `2b.security`, `3.release`, `4.deploy`; jobs carry the number plus a letter
   - [x] Replace the em dashes in job names in `2a.quality.yml` ("API: lint, test, build", etc.)
3. [~] Speed
   - [n] Security and container-scan no longer `needs: quality`. Kept on purpose: they only start after quality passes, to save runner minutes when tests fail
   - [x] `2a.quality.yml`: `docker` job deleted (PR image build is covered by container-scan)
   - [n] `e2e` no longer `needs: [api, app]`. Kept on purpose, same reason
   - [x] npm cache for both lockfiles; Playwright browser cache
   - [x] Dockerfiles: copy `package*.json`, `npm ci`, then copy source (api build stage, app build stage)
4. [x] Concurrency
   - [x] `2.ci.yml`: workflow-level `ci-${{ github.ref }}`, cancel in progress on PRs only. Per-reusable groups removed
   - [x] `3.release.yml`: group `release`, cancel false
   - [x] `1.review.yml`: group per ref, cancel true
5. [x] Deploy safety
   - [x] `4.deploy.yml` build pushes `:sha` only; `:vX.Y.Z` is added when `promote` runs
   - [x] New `promote` job after `scan`: retag `:latest` and `:vX.Y.Z` with `imagetools create`
   - [x] Secrets via `env:`, not inline `${{ }}` in shell
6. [x] Release summary
   - [x] `3.release.yml` step writes `$GITHUB_STEP_SUMMARY` for the three outcomes
   - [x] `2.ci.yml`: drop unused `packages: write`
7. [x] Docs
   - [x] `README.md` "CI workflows" section: workflow table and deploy rules (no separate docs file)
8. [x] Verify
   - [x] actionlint via Docker image on all workflows
   - [x] zizmor clean at medium severity and above
   - [x] Docker builds locally: api and app production targets, both succeed
     - Cold (`--no-cache`): api 26.6s, app 43.6s
     - Source-only change, warm cache: api 20.1s (5 layers cached), app 13.9s (7 layers cached). The `npm ci` layer is reused
   - [x] PR CI run (#275, commit b3e6c16): 2. CI took 6m33s wall clock, 1. Review took 16s. Baseline was 6m47s on the #274 merge
     - The PR run also does work the baseline did not: container scans (2c), workflow-scanning CodeQL and the root `npm audit`
9. [x] Hardening (added during review)
   - [x] Actions pinned to commit SHAs, no persisted checkout credentials, job timeouts
   - [x] Default no permissions, per-job grants
   - [x] Deploy only from `main`, VPS fast-forwards to the released SHA, health check on `/api/v1/health`
   - [x] Release deploy gated on a quality re-run (3b)
   - [x] Node 26 in CI to match the Dockerfiles
   - [x] Dependabot: compose ecosystem, 7-day cooldown, grouped updates, Conventional Commit prefixes
   - [x] Workflow lint job (actionlint and zizmor) in `1.review.yml`
