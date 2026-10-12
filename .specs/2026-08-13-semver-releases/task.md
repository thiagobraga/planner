# SemVer + Releases + Changelog — Tasks

## Discovery

- [x] Inventory the current versioning surface in root, `api/`, and `app/`
- [x] Identify the minimum files that must participate in release version bumps
- [x] Confirm how release tags and GitHub Releases should be published in this repo

## Release foundation

- [x] Add or standardize the root release manifest needed by the chosen automation
- [x] Seed the baseline release version to the current project starting point
- [x] Align package versions and lockfile metadata with the chosen release version

## Automation

- [x] Add release automation configuration for SemVer bumps
- [x] Configure release PR generation, tag creation, and GitHub Release publishing
- [~] Set repository permissions and workflow triggers required for release automation
- [x] Confirm automation does not interfere with existing CI or deploy workflows

## Changelog

- [x] Add `CHANGELOG.md`
- [~] Write the `Unreleased` section and release entry template
- [x] Define the changelog categories and entry style to use going forward

## Process docs

- [x] Document how commits map to version bumps
- [x] Document how to cut a release, what gets tagged, and what gets published
- [x] Document how package versions and release tags relate to deployment version identifiers

## Verification

- [ ] Verify release metadata is internally consistent
- [ ] Verify changelog format matches Keep a Changelog
- [ ] Verify the repo has a clear baseline for the first tagged release

## Discovery findings

Versioning surface:

- Root `package.json` is `private`, has no `version`. `package-lock.json` root entry has no version either.
- `api/package.json` and `app/package.json` are both `0.1.0`; `api/package-lock.json` and `app/package-lock.json` carry `0.1.0` twice each (top level + `packages[""]`).
- No git tags, no GitHub Releases. Baseline is therefore free to choose (`0.1.0` matches the packages).
- Default branch `main`. Commits already follow Conventional Commits (merge commits aside), so commit-driven bumps work.

Files that must participate in a bump: root `package.json` (new `version`), `api/package.json`, `app/package.json`, their three lockfiles, `CHANGELOG.md`.

Do NOT touch (different purpose): `api/src/utils/buildInfo.ts` (`BUILD_ID` file stamped by `.docker/api/Dockerfile` at image build), `/api/v1/version`, `useVersionCheck`, `LATEST_VERSION`. These detect new deploys, not releases. Docker images are tagged `latest` and `${{ github.sha }}` in `deploy.yml`.

CI constraints:

- `pipeline.yml` ignores `**.md` and `.specs/**`, runs on push/PR to `main`. A release PR touching `package.json` will run CI normally.
- Repo setting "Allow GitHub Actions to create and approve pull requests" is OFF (`can_approve_pull_request_reviews: false`, default token `read`). release-please with `GITHUB_TOKEN` cannot open the release PR until this is enabled or a PAT is used. PRs opened by `GITHUB_TOKEN` also do not trigger CI.
- `deploy.yml` is `workflow_dispatch` / `workflow_call` only; it does not react to tags.

Decisions: release-please with `GITHUB_TOKEN`; deploy chained from `release.yml` via `workflow_call`; plain pushes to `main` no longer deploy (removed `deploy` job from `pipeline.yml`); images also tagged `vX.Y.Z`. Blue-green is a separate spec.

Known deviations: release-please writes `## [X.Y.Z](compare) (date)` and has no `[Unreleased]` section, so the changelog is Keep a Changelog style (Added/Changed/Fixed/Removed) but not byte-exact.

Manual follow-up for the repo owner: enable Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests".
