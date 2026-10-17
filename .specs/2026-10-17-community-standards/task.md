# Community Standards - Implementation Tasks

Status: specification saved; community files have not been implemented.

## 1. Create isolated implementation environment

- [ ] 1.1 Confirm the intended base branch and existing worktree state; preserve unrelated changes in the current checkout.
- [ ] 1.2 Create `/p/projects/planner-community-standards` on `docs/community-standards` from the current `main`.
- [ ] 1.3 Install repository hooks and open a draft PR containing the implementation checklist before implementing the standards.

## 2. Add community policies

- [ ] 2.1 Add `.github/CODE_OF_CONDUCT.md` using the complete Contributor Covenant 3.0 text and its required attribution. Set `thi@thiagobraga.dev` as the private report channel; do not invite reports in public issues.
- [ ] 2.2 Add `.github/SECURITY.md` stating that the latest stable release and `main` are supported, older versions are unsupported, and reports must use GitHub's private vulnerability reporting flow. Do not state a response or remediation deadline.
- [ ] 2.3 Add `.github/ACCESSIBILITY.md` with a practical commitment, a clear issue-based barrier reporting path, and only verified known barriers or environments. Do not claim WCAG conformance or a tested support matrix without evidence.

## 3. Add contributor and issue guidance

- [ ] 3.1 Add `.github/CONTRIBUTING.md` covering fork/branch workflow, Conventional Commit and semantic branch conventions, Docker-based setup, relevant lint/test/build checks, and pull request expectations. Keep commands consistent with `README.md` and `AGENTS.md`.
- [ ] 3.2 Add a bug issue form asking for a concise problem description, reproduction steps, expected and actual behavior, and relevant environment/version details.
- [ ] 3.3 Add a feature request form asking for the problem, proposed outcome, and relevant context. Neither form should require unrelated fields.
- [ ] 3.4 Add `.github/ISSUE_TEMPLATE/config.yml` to show both forms and leave blank issues enabled. Do not add a separate public security issue form.
- [ ] 3.5 Add `.github/PULL_REQUEST_TEMPLATE.md` with change summary, related issue, validation performed, and a prompt for screenshots when the change affects rendered UI.
- [ ] 3.6 Update the existing `README.md` Contributing section to link to `.github/CONTRIBUTING.md`; remove duplicate instructions while retaining the concise summary.

## 4. Validate and deliver

- [ ] 4.1 Parse both issue forms and the chooser configuration as YAML; validate markdown links and referenced paths.
- [ ] 4.2 Review every policy for consistency with current repository practices, correct private reporting destinations, no invented promises, and no unsupported accessibility claims.
- [ ] 4.3 Confirm the GitHub community profile recognizes each applicable file after the changes reach the default branch; verify issue and pull request creation displays the intended templates.
- [ ] 4.4 Commit scoped documentation changes with Conventional Commit messages and the required Codex co-author trailer; update this checklist as tasks complete.
- [ ] 4.5 Keep the worktree and stack available for review; mark the PR ready after validation and GitHub template checks pass.
