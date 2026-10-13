# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [x] Names and order
   - [x] Files and names numbered `1.review`, `2.ci`, `2a.quality`, `2b.security`, `3.release`, `4.deploy`; jobs carry the number plus a letter
   - [x] Replace the em dashes in job names in `2a.quality.yml` ("API: lint, test, build", etc.)
3. [~] Speed
   - [ ] Security and container-scan no longer `needs: quality`. Kept on purpose: they only start after quality passes, to save runner minutes when tests fail
   - [x] `2a.quality.yml`: `docker` job deleted (PR image build is covered by container-scan)
   - [ ] `e2e` no longer `needs: [api, app]`. Kept on purpose, same reason
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
8. [~] Verify
   - [x] actionlint via Docker image on all workflows
   - [x] zizmor clean at medium severity and above
   - [ ] Docker builds locally: api and app production targets
   - [~] PR CI run (#275): timings vs baseline (6m47s wall clock on #274 merge)
9. [x] Hardening (added during review)
   - [x] Actions pinned to commit SHAs, no persisted checkout credentials, job timeouts
   - [x] Default no permissions, per-job grants
   - [x] Deploy only from `main`, VPS fast-forwards to the released SHA, health check on `/api/v1/health`
   - [x] Release deploy gated on a quality re-run (3b)
   - [x] Node 26 in CI to match the Dockerfiles
   - [x] Dependabot: compose ecosystem, 7-day cooldown, grouped updates, Conventional Commit prefixes
   - [x] Workflow lint job (actionlint and zizmor) in `1.review.yml`
