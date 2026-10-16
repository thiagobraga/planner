# Specs-Issues Sync - Tasks

## 1. Setup

- [ ] 1.1 `git worktree add ../planner-spec-sync -b feat/spec-issues-sync`
- [ ] 1.2 `.env` from `.env.example`; `COMPOSE_PROJECT_NAME=planner-specsync`, `APP_SUBDOMAIN=specsync.planner`
- [ ] 1.3 `bash .hooks/setup-hooks.sh`; `docker compose up -d` (not strictly needed, no app code changes)
- [ ] 1.4 Push branch, open draft PR against `main`
- [ ] 1.5 Create `spec` label in GitHub (`gh label create spec --description "Spec tracking" --color ebe6de`) if missing

## 2. Sync script `scripts/sync-spec-issues.sh` (bash, TDD via shell tests)

- [ ] 2.1 CLI shape: `sync-spec-issues.sh [--all] [--check] [<spec-dir>...]`; default derives changed spec dirs from `git diff`
- [ ] 2.2 Slug resolution: basename of `.specs/<slug>`; skip `completed/` for create path; read `issue:` frontmatter from `plan.md` if present
- [ ] 2.3 Fallback mapping: if no frontmatter, find issue by marker search `gh issue list --search "<!-- spec: <slug> -->" --json number` before creating
- [ ] 2.4 Body build: `plan.md` content (strip `issue:` frontmatter line) + footer with marker, branch/PR link (`GITHUB_*` env when in Actions, git fallback locally), `Progress: x/y` from `task.md` counts (`grep -c "\[x\]"` / total `\[ \]`)
- [ ] 2.5 Create: `gh issue create --title "[$slug-short] $h1" --label spec --body-file ...`; write returned number back into `plan.md` as `issue: N` (insert or replace first frontmatter line)
- [ ] 2.6 Update: `gh issue edit <N> --body-file ...` only when body differs from current (`gh issue view --json body` compare); `--check` exits 1 on diff without writing
- [ ] 2.7 Auth handling: require `GH_TOKEN`/`GITHUB_TOKEN`; clear error when missing; `--no-verify` path never blocks (caller decides exit code)
- [ ] 2.8 Tests in `scripts/sync-spec-issues.test.sh`: body builder, progress counter, frontmatter insert/replace, marker search parsing, check-mode diff; mock `gh` via PATH stub following `scripts/ci-changes.test.sh` style

## 3. Workflow `.github/workflows/5.spec-sync.yml`

- [ ] 3.1 Triggers: `push` (branches, `paths: .specs/**`), `pull_request` (types opened/synchronize, `paths: .specs/**`), `issues` (types closed/reopened)
- [ ] 3.2 Permissions: `issues: write, contents: read, pull-requests: read`; push/archive job needs `contents: write, pull-requests: write` for bot PR
- [ ] 3.3 Spec-to-issue job (ubuntu-24.04, `gh` preinstalled): checkout full history for diff, run script for changed spec dirs; pass `GITHUB_HEAD_REF`/`GITHUB_SHA` for footer links
- [ ] 3.4 Issue-closed job: parse `<!-- spec: <slug> -->` from issue body; if folder still in `.specs/<slug>/`, `git mv` to `.specs/completed/<slug>/`, open PR `chore: archive spec <slug>` with `gh pr create`, body `Closes #N` omitted (issue already closed, use `Related to #N`)
- [ ] 3.5 Issue-reopened job: reverse move `completed/<slug>` to root, open PR similarly
- [ ] 3.6 Guard: no-op when marker missing or folder already in target location; log to step summary
- [ ] 3.7 Keep `ci.yml` `paths-ignore: .specs/**` as is; verify spec-only pushes run only the new workflow

## 4. Local hook fallback (warn-only)

- [ ] 4.1 `.hooks/pre-push`: after `run_all`, if changed files include `.specs/**` and `gh` is authed, run `scripts/sync-spec-issues.sh` for those dirs; never fail the push (warn on error, respect `SKIP_HOOKS=1`)
- [ ] 4.2 Reuse `packages_touched_by` behavior: `.specs/` matches no package so existing checks stay silent; add small `specs_touched_by` helper in `.hooks/_lib.sh` if needed, no change to `run_all` semantics

## 5. Backfill and docs

- [ ] 5.1 One manual run `bash scripts/sync-spec-issues.sh --all` for active `.specs/*/` root folders only (skip `completed/`); verify 1 issue each, `issue:` frontmatter written
- [ ] 5.2 Document in `plan.md` footer convention and in `CLAUDE.md` Plan Mode section: new spec flow (add folder, push/PR, issue appears, close issue to archive)
- [ ] 5.3 Small Conventional Commits per step (`feat:`, `test:`), push at milestones, mark PR ready

## 6. Verification

- [ ] 6.1 `bash scripts/sync-spec-issues.test.sh` and `bash scripts/ci-changes.test.sh` green
- [ ] 6.2 `actionlint` + `zizmor` clean on the new workflow (same pins as `1.review.yml`: `rhysd/actionlint:1.7.12`)
- [ ] 6.3 Dry run on worktree branch: add dummy spec change, run script with stubbed `gh`, confirm body + footer + progress line
- [ ] 6.4 Live check (main repo, after merge): close a test issue, confirm archive PR opens and moves folder; reopen, confirm restore PR
- [ ] 6.5 Confirm spec-only push triggers only `5.spec-sync`, not full CI gate
