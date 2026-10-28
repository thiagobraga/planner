# Community Standards

## Goal

Help people understand how to contribute to Planner, report problems, and engage safely with the project. Add the community guidance GitHub expects while making the reporting paths clear and keeping claims aligned with current project practices.

## User flows

### 1. Contributing to Planner

- A contributor finds contribution guidance from the repository README.
- The guidance explains the project's contribution workflow, branch and commit conventions, local setup, and checks to run before opening a pull request.
- A pull request template helps contributors summarize the change and its validation, including screenshots for visible UI changes.

### 2. Reporting a problem or requesting a feature

- A user chooses a bug report or feature request form when opening an issue.
- The form asks for enough context to understand and reproduce the report without requiring irrelevant information.
- Users can still open a blank issue for topics that do not fit either form.

### 3. Reporting conduct or security concerns

- Community members can report conduct concerns privately to `thi@thiagobraga.dev`.
- Security researchers use GitHub's private vulnerability reporting. They are told not to publish vulnerability details in an issue or pull request.
- The security policy states that the latest stable release and `main` are supported. It does not promise a response or fix deadline.

### 4. Reporting accessibility barriers

- Users can find an accessibility statement in the repository and learn how to report a barrier through GitHub issues.
- The statement describes an ongoing commitment and reporting path without claiming a conformance level or support matrix that has not been verified.

## Acceptance criteria

- GitHub recognizes the code of conduct, contributing guide, security policy, issue templates, pull request template, and accessibility statement from their documented locations.
- The conduct policy uses Contributor Covenant 3.0 and names the private reporting address above.
- The security policy links to the repository's private vulnerability reporting flow, which is enabled, and gives supported-version guidance without an SLA.
- Issue forms cover bug reports and feature requests; blank issues remain available.
- README contribution guidance links to the new contributing guide without duplicating its instructions.
- The pull request template asks for a concise summary, related issue, validation performed, and screenshots where visual changes apply.
- Accessibility wording provides a clear reporting route and makes no unsupported accessibility claims.
- All internal links and issue form YAML validate.

## Relevant Files

- `.github/CODE_OF_CONDUCT.md` - community expectations and private conduct reporting
- `.github/CONTRIBUTING.md` - contribution workflow and checks, linked from `README.md`
- `.github/SECURITY.md` - supported versions and private vulnerability reporting
- `.github/ACCESSIBILITY.md` - accessibility commitment, known barriers, and reporting path
- `.github/ISSUE_TEMPLATE/bug_report.yml` - actionable bug reports
- `.github/ISSUE_TEMPLATE/feature_request.yml` - feature proposals
- `.github/ISSUE_TEMPLATE/config.yml` - issue chooser and blank-issue setting
- `.github/PULL_REQUEST_TEMPLATE.md` - change summary and verification prompts
- `README.md` - link to contribution guidance
