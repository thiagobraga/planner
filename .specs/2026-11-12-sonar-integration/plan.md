# Sonar integration

## Outcome

Planner maintainers can view maintainability, duplication, security, and test coverage for `api`, `app`, and `site` in one Sonar project, with analysis of trusted pull requests and the default branch. Existing ESLint, CodeQL, tests, and security scans remain in place.

## Decision before implementation

- [ ] Choose SonarQube Cloud (recommended, hosted) or an existing self-hosted SonarQube Server. Confirm repository visibility, plan pricing and limits, supported PR analysis, data residency, and permission to send source code to the selected service. Do not deploy a server without a separate approved operations plan.
- [ ] Confirm the Sonar organization/project keys, GitHub integration, access owner, and quality gate. Do not create accounts, change branch protection, or provision external resources without owner approval.
- [ ] Confirm secret availability and desired behavior for forked PRs, Dependabot, outages, and missing credentials. Never run untrusted PR code with privileged tokens or use `pull_request_target` to execute it. Record any unsupported event as an explicit limitation, not a successful scan.

## Current project

- `.github/workflows/2a.quality.yml` runs package coverage in separate jobs; `site` is conditional on `site_changed`. Coverage files do not automatically cross job boundaries.
- `.github/workflows/ci.yml` orchestrates checks and the CI gate. `.github/workflows/2b.security.yml` already runs CodeQL with security and quality queries.
- `api`, `app`, and `site` are independent npm packages. Root `vitest.config.ts` also defines a unified test configuration. Verify actual package coverage paths and formats before choosing a pipeline.

## Tasks

1. **Choose and configure the service**
   - [ ] Check current official Sonar documentation for the selected edition, scanner version, supported Node/TypeScript versions, PR integration, coverage import, and required permissions.
   - [ ] Configure one Sonar project for the repository unless service limitations require separate projects; document the final choice and any costs.
   - [ ] Store a least-privilege scan token in the appropriate GitHub Actions secret; configure any host URL as a non-secret variable when needed. Never commit credentials.

2. **Configure analysis and coverage**
   - [ ] Add `sonar-project.properties` or equivalent with verified project identity, source/test separation, TypeScript project configuration, and narrow exclusions for generated files, dependencies, build output, and coverage reports. Preserve analysis of real source and tests.
   - [ ] Produce LCOV for all three packages and verify each report references the checked-out source paths. Do not treat the Playwright HTML report as LCOV or add overlapping coverage counts without validating the merge.
   - [ ] Transfer reports from coverage jobs to the scan job using artifacts, or run a dedicated coverage job. Ensure `site_changed=false` cannot silently leave site coverage missing or stale; choose either always generating coverage for all scanned packages or an explicit, documented partial-analysis design.
   - [ ] Use full Git history when required by Sonar for blame and PR/new-code analysis. Pin GitHub actions to verified full commit SHAs, following existing conventions.

3. **Wire CI securely**
   - [ ] Integrate scanning into the reusable workflow and `.github/workflows/ci.yml` as appropriate. Pass secrets explicitly through reusable workflow boundaries and use least GitHub permissions.
   - [ ] Start in reporting mode, while preserving existing required checks. Specify status behavior separately for failed analysis, failed quality gate, missing reports, unavailable service, and untrusted PRs.
   - [ ] After a baseline and maintainer approval, make the selected new-code quality gate required only where a reliable check is produced; update the existing aggregate gate and branch protection deliberately. Do not create a permanently pending check for skipped events.
   - [ ] Avoid redundant rules with CodeQL and the separate local ESLint/SonarJS plan; document which tool owns each enforcement decision.

4. **Validate and document**
   - [ ] Run workflow lint and relevant CI routing tests; verify coverage artifacts and LCOV path mapping for all packages.
   - [ ] Run an actual default-branch analysis and trusted PR analysis; verify project scope, reported coverage per package, PR decoration, and quality-gate status. Exercise a controlled failing-gate case and the agreed missing-secret/fork behavior.
   - [ ] Document setup, commands, permissions, quality-gate behavior, troubleshooting, and external-service limitations in `README.md` or suitable project documentation. Report any checks not executable without owner credentials.

## Relevant files

- `.github/workflows/ci.yml`, `.github/workflows/2a.quality.yml`, `.github/workflows/2b.security.yml`
- `vitest.config.ts`, `api/vitest.config.ts`, `app/vitest.config.ts`, `site/vitest.config.ts`
- `api/package.json`, `app/package.json`, `site/package.json`, corresponding lockfiles if needed
- `sonar-project.properties` (new, if used), `README.md`, `scripts/ci-changes.test.sh`, `scripts/hooks.test.sh`

## Acceptance

- [ ] Selected service and owner-approved credentials are configured without exposing secrets.
- [ ] Trusted PR and default-branch analyses cover the intended source with verified fresh LCOV for `api`, `app`, and `site`.
- [ ] Quality-gate and failure behavior matches the documented rollout, including forked PRs and unavailable service.
- [ ] Existing quality and security checks remain operational; workflow checks pass.
