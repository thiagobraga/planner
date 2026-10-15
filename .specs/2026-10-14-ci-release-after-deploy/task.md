# Tasks

1. [x] Lint
   - [x] `no-unused-vars` to `error` in `api/eslint.config.js` and `app/eslint.config.js` (0 existing violations; verified a temp file exits 1)
2. [x] Orchestrator
   - [x] `ci.yml`: triggers moved from `2.ci.yml`, `changes` job (0a) computes `workflows` and `code` from the PR file list, other events output true
   - [x] Job names kept (`2a. Quality`, `2b. Security`, `2c. Container scan (...)`) so required check names are unchanged
   - [x] Remove `2.ci.yml`
3. [x] Reusable workflows
   - [x] `1.review.yml`: `workflow_call`, input `workflows_changed` gates 1b
   - [x] `2b.security.yml`: input `codeql` gates CodeQL
   - [x] `2c.container.yml`: extracted from `2.ci.yml`
   - [x] `3.release.yml`: `workflow_call`, 3a tip check uses `github.sha`, outputs `release_created`, `version`, `tag`; optional secret `RELEASE_PLEASE_TOKEN`
4. [x] Release after deploy
   - [x] `release-config.json`: `draft: true`, `force-tag-creation: true`
   - [x] `4.deploy.yml`: input `tag`, job `4f` publishes the draft with `gh release edit --draft=false --latest`, needs `deploy`
5. [x] Docs
   - [x] README badges, workflow table, release section, token note
6. [ ] Verify
   - [x] actionlint clean
   - [x] zizmor ran successfully in [PR #294 workflow lint](https://github.com/thiagobraga/planner/actions/runs/38594192461/job/115956633623); no local zizmor binary is installed
   - [x] PR pipeline run on [PR #294](https://github.com/thiagobraga/planner/pull/294): applicable review, quality, security, and container checks passed
   - [x] First real release after merge: [v0.4.2](https://github.com/thiagobraga/planner/releases/tag/v0.4.2) was created as a draft, its [deploy run](https://github.com/thiagobraga/planner/actions/runs/38622584238) passed 4e public health checks, and 4f published the release at 2026-10-14 19:30:10 UTC
   - [x] The next release PR, [#297](https://github.com/thiagobraga/planner/pull/297), computed v0.5.0 after v0.4.2
   - [ ] Resolve the later [v0.5.0 release run](https://github.com/thiagobraga/planner/actions/runs/38674186053): release-please could not create the tag (`Resource not accessible by personal access token`), so deploy was skipped and v0.5.0 is unpublished
