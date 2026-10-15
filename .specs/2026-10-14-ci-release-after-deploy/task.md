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
   - [ ] zizmor
   - [ ] PR pipeline run on this PR (0a, 1, 2a, 2b, 2c as applicable)
   - [ ] First real release after merge: draft appears, publishes after 4e, next release PR is computed from the right tag
