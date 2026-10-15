# CI: one pipeline, release published after a healthy deploy

## What changes for the user

- One workflow, **CI**, is the only thing that starts on a PR, a push to `main`, the Monday schedule or a manual run. The numbered workflows (1 review, 2a quality, 2b security, 2c container scan, 3 release, 4 deploy) appear as steps inside that single run.
- A GitHub Release is no longer announced before the app is live. Merging the release PR creates the `vX.Y.Z` tag and a **draft** release. The release becomes public (and "latest") only after the blue/green deploy passed the public health check. A failed deploy rolls back and leaves the draft unpublished.
- An unused variable now fails lint, locally (pre-commit) and in CI.
- Workflow lint (1b) runs only when a PR touches `.github/`. The container scan (2c) runs only when a PR touches `api/`, `app/`, `.docker/` or root `package*.json`. CodeQL (2b) runs when source or workflows changed. Pushes to `main`, the schedule and manual runs run everything.

## Flow

```
PR:            0a changes -> 1 review, 2a quality -> 2b security, 2c container scan
push to main:  2a quality -> 2b security -> 3 release (release PR, or tag + draft release)
               -> 4 deploy (build, scan, promote, VPS blue/green) -> 4f publish release
```

## Decisions

- Image is built once per commit in deploy (4b), scanned (4c) and promoted by retag (4d). The deployed image is the scanned one. PR container scans stay separate: a PR commit is not the release commit.
- Publishing the release uses the workflow `GITHUB_TOKEN` (`contents: write`). No new secret. `RELEASE_PLEASE_TOKEN` stays optional, only for checks on the release PR.
- `draft: true` plus `force-tag-creation: true` in `release-config.json`: GitHub creates no tag for a draft, and release-please needs the tag to find the previous release.
- No merge queue, no extra approval step now.

## Risks to watch on the first real release

- release-please with `draft` and `force-tag-creation` is untested in this repo. Check that the next release PR after a published release is computed from the right tag.
- A failed deploy leaves a draft release and a tag. Publish it by hand or merge the next release PR.
- CodeQL and Trivy SARIF configs keyed to `2.ci.yml` become stale in the Security tab. Delete them there.

## Relevant Files

- `.github/workflows/ci.yml` (new entry point)
- `.github/workflows/1.review.yml`, `2b.security.yml`, `3.release.yml`, `4.deploy.yml` (now reusable, inputs added)
- `.github/workflows/2c.container.yml` (new, moved out of `2.ci.yml`)
- `.github/workflows/2.ci.yml` (removed)
- `release-config.json`
- `api/eslint.config.js`, `app/eslint.config.js`
- `README.md`
