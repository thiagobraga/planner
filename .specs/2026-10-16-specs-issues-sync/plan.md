# Specs-GitHub Issues Sync

## What

Every folder in `.specs/` gets one matching GitHub Issue, automatically. Creating a spec creates an issue for discussion and tracking. Editing `plan.md` updates the issue. Closing the issue archives the spec to `.specs/completed/`. Reopening restores it.

One issue per spec, nothing more. Task checkboxes in `task.md` are not mirrored as sub-issues, only counted as `Progress: x/y`.

## User flows

### 1. New spec creates an issue

- I add `.specs/2026-10-16-my-feature/plan.md` and `task.md` on a branch and open a PR (or push to `main`).
- A sync job creates an issue titled `[my-feature] My Feature`, labeled `spec`, with the `plan.md` content as body plus a footer: branch/PR link, progress count, and marker `<!-- spec: 2026-10-16-my-feature -->`.
- The issue number is written back into `plan.md` frontmatter as `issue: 123` so reruns are idempotent.

### 2. Editing plan.md updates the issue

- I edit `plan.md` and push. The sync job updates the issue body to match, preserving the footer.
- Edits to `task.md` only update the `Progress: x/y` line (checked boxes over total boxes).
- Issue comments stay in GitHub only and never write back to the spec.

### 3. Closing the issue archives the spec

- I close the issue when the work ships or is dropped.
- A bot opens a `chore: archive spec <slug>` PR that moves `.specs/<slug>/` to `.specs/completed/<slug>/`.
- I merge that PR. The issue already being closed is the end state.

### 4. Reopening restores the spec

- I reopen a closed issue by mistake or to resume work.
- A bot opens a PR moving the folder back from `completed/` to `.specs/` root.
- I merge it and keep working.

## Design rules

- Specs stay source of truth for text. GitHub stays place for discussion.
- Sync is one-way for content: repo to issue. Never issue to repo, except the folder move on close/reopen.
- Sync must be idempotent: rerunning with no changes does nothing and creates no duplicates or comments.
- `completed/` specs never get retroactive issues. Only the ~16 active specs are backfilled once.

## Out of scope

- Per-task sub-issues or GitHub Projects board views.
- Syncing `task.md` checkbox state individually, assignees, or milestones.
- Direct pushes to `main` by the bot; all archive moves go through PR review.

## Relevant Files

- `.specs/*/plan.md` - sync source; gains `issue: N` frontmatter
- `.specs/*/task.md` - only the `[ ]`/`[x]` count is synced as `Progress:`
- `scripts/sync-spec-issues.sh` (new) - create/update logic via `gh`, used by CI and hooks
- `scripts/sync-spec-issues.test.sh` (new) - shell tests following `scripts/ci-changes.test.sh` pattern
- `.github/workflows/5.spec-sync.yml` (new) - `push`/`pull_request` on `.specs/**` plus `issues.closed`/`reopened`
- `.github/workflows/ci.yml` - already ignores `.specs/**`; keep that, run spec-sync separately
- `.hooks/pre-push` - warn-only local fallback call to the sync script
- `.hooks/_lib.sh` - shared hook helpers (`packages_touched_by` already ignores `.specs/`)
- `.hooks/setup-hooks.sh` - no change expected, listed for hook install context
