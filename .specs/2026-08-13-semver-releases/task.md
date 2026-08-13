# SemVer + Releases + Changelog — Tasks

## Discovery

- [ ] Inventory the current versioning surface in root, `api/`, and `app/`
- [ ] Identify the minimum files that must participate in release version bumps
- [ ] Confirm how release tags and GitHub Releases should be published in this repo

## Release foundation

- [ ] Add or standardize the root release manifest needed by the chosen automation
- [ ] Seed the baseline release version to the current project starting point
- [ ] Align package versions and lockfile metadata with the chosen release version

## Automation

- [ ] Add release automation configuration for SemVer bumps
- [ ] Configure release PR generation, tag creation, and GitHub Release publishing
- [ ] Set repository permissions and workflow triggers required for release automation
- [ ] Confirm automation does not interfere with existing CI or deploy workflows

## Changelog

- [ ] Add `CHANGELOG.md`
- [ ] Write the `Unreleased` section and release entry template
- [ ] Define the changelog categories and entry style to use going forward

## Process docs

- [ ] Document how commits map to version bumps
- [ ] Document how to cut a release, what gets tagged, and what gets published
- [ ] Document how package versions and release tags relate to deployment version identifiers

## Verification

- [ ] Verify release metadata is internally consistent
- [ ] Verify changelog format matches Keep a Changelog
- [ ] Verify the repo has a clear baseline for the first tagged release
