# CI/CD reorganization

## Problem

The Actions page is hard to read. Workflows sort alphabetically (Claude Code, Dependabot, Deploy, Pipeline, Quality, Release, Security), so the order of work is invisible. Reusable workflows (Quality, Security, Deploy) look like independent pipelines. CI is slow: about 6 to 7 minutes on PRs, mostly from serial jobs.

Merging a release-please PR (#274 was only chore and docs) also gives no clear signal. Release runs, finds nothing user-facing, and Deploy is skipped. Nothing says why.

## Goals

- The sidebar reads in flow order: CI, Release, Deploy, then the rest.
- Each run's summary says what happened and why, including "no release".
- PR CI finishes faster by removing serial waits and duplicate image builds.
- `:latest` is only moved after the image passes the vulnerability scan.

## User-visible behavior

- Sidebar: `1 CI`, `1a Quality (reusable)`, `1b Security (reusable)`, `2 Release`, `3 Deploy (reusable or manual)`, `PR Dependency Review`, `Claude Code`.
- Release run summary states one of: released vX.Y.Z and deploy runs next; release PR created or updated; no user-facing commits, so nothing to release or deploy.
- Deploy only follows a release. Pushes to `main` that are not release merges do not reach the VPS. This is unchanged and is now documented in `docs/ci.md`.

## Non-goals

- Renaming workflow files. `README.md` links `pipeline.yml`, and `name:` alone drives the sidebar.
- Changing branch protection. None exists.
- Pinning actions to SHAs. Follow-up.
- Removing GitHub's dynamic "GitHub Advanced Security" or "Dependabot Updates" entries. GitHub manages those.

## Relevant files

- `.github/workflows/pipeline.yml`
- `.github/workflows/quality.yml`
- `.github/workflows/security.yml`
- `.github/workflows/release.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/dependency-review.yml`
- `.docker/api/Dockerfile`
- `.docker/app/Dockerfile`
- `docs/ci.md` (new)
- `README.md` (link to `docs/ci.md`)
