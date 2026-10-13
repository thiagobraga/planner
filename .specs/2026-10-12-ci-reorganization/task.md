# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [ ] Names and order
   - [ ] `pipeline.yml` name `1 CI`; `quality.yml` `1a Quality (reusable)`; `security.yml` `1b Security (reusable)`
   - [ ] `release.yml` `2 Release`; `deploy.yml` `3 Deploy (reusable or manual)`; `dependency-review.yml` `PR Dependency Review`
   - [ ] Replace the em dashes in job names in `quality.yml` ("API - lint, test, build", etc.)
3. [ ] Speed
   - [ ] `pipeline.yml`: Security no longer `needs: quality`; container-scan no longer `needs: quality`
   - [ ] `quality.yml`: delete `docker` job (PR image build is covered by container-scan)
   - [ ] `quality.yml`: `e2e` no longer `needs: [api, app]`; npm cache for both lockfiles; Playwright browser cache
   - [ ] Dockerfiles: copy `package*.json`, `npm ci`, then copy source (api build stage, app build stage)
4. [ ] Concurrency
   - [ ] `pipeline.yml`: workflow-level `ci-${{ github.ref }}`, cancel in progress. Remove per-reusable groups, which would collide once jobs run in parallel
   - [ ] `release.yml`: group `release`, cancel false
   - [ ] `dependency-review.yml`: group per ref, cancel true
5. [ ] Deploy safety
   - [ ] `deploy.yml` build pushes `:sha` (and `:vX.Y.Z` input) only
   - [ ] `deploy.yml` new `promote` job after `scan`: retag `:latest` and `:vX.Y.Z` with `imagetools create`
   - [ ] `deploy.yml` secrets via `env:`, not inline `${{ }}` in shell
6. [ ] Release summary
   - [ ] `release.yml` step writes `$GITHUB_STEP_SUMMARY` for the three outcomes
   - [ ] `pipeline.yml`: drop unused `packages: write`
7. [ ] Docs
   - [ ] `README.md` "CI workflows" section: workflow table and deploy rules (no separate docs file)
8. [ ] Verify
   - [ ] actionlint via Docker image on all workflows
   - [ ] Docker builds locally: api and app production targets
   - [ ] PR CI run: timings vs baseline (6m47s wall clock on #274 merge)
