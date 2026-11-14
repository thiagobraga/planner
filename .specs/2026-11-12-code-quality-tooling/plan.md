# Local code quality tooling

## Outcome

Developers can measure type safety, complexity, duplication, and unused code locally and in CI across `api`, `app`, and `site`. Existing findings are baselined before enforcement, without hiding new regressions or deleting code solely because a tool reports it unused.

This plan is independent of the Sonar integration plan. Coordinate duplicated SonarJS rules and duplication reporting so developers do not receive identical blocking findings twice.

## Tasks

1. **Inventory and baseline**
   - [ ] Inspect the current ESLint flat configs, TS project references, npm scripts, CI routing, generated files, package entry points, and the actual Node/TypeScript/ESLint versions and peer dependencies.
   - [ ] Record clean-checkout baseline counts, commands, duration, and known false positives for each package. Do not report success based only on suppressed findings.
   - [ ] Pick versions compatible with Node >=24, ESLint 10, TypeScript 6, and each other; document any compatibility blocker rather than forcing peer dependencies.

2. **Type-aware ESLint and SonarJS**
   - [ ] Configure `typescript-eslint` `strictTypeChecked` for relevant TypeScript source in `api/eslint.config.js`, `app/eslint.config.js`, and `site/eslint.config.js`. Use project service or appropriate per-package TS configs and correctly scoped file patterns; handle JS config files and E2E separately when not in TS projects.
   - [ ] Preserve existing React Hooks rules and existing lint behavior. Check real diagnostics for floating and misused promises, unsafe types, and false positives; review overlapping strict rules and cost.
   - [ ] Install and configure a compatible `eslint-plugin-sonarjs` for the three packages, including cognitive complexity. Select only actionable rules and avoid duplicate reports with Sonar server analysis.
   - [ ] Enable ESLint core complexity and maintainability rules such as `complexity`, `max-depth`, `max-params`, and `max-lines-per-function` using measured thresholds. Distinguish cyclomatic from cognitive complexity; respect the existing 1000-line file rule.
   - [ ] Introduce existing violations as warnings or a tracked baseline. Design a reliable changed-code or no-regression enforcement mechanism before claiming warnings prevent regressions; avoid broad blanket disables.

3. **Unused code and duplication**
   - [ ] Install and configure Knip for the three independent packages, with actual entry points for Vite, tests, Playwright, scripts, generated parser artifacts, and API startup. Run it from a reproducible root or package script using correct lockfiles.
   - [ ] Triage unused files, exports, and dependencies manually; distinguish runtime imports, CLI entry points, tooling, and false positives. Do not automatically delete user code or dependencies. Keep a reviewed baseline and document exceptions.
   - [ ] Install and configure `jscpd` for relevant source files across packages, with explicit generated/test exclusions and a justified minimum clone size. Publish a readable report and a baseline-derived threshold or robust no-regression check.

4. **Type coverage**
   - [ ] Install `type-coverage` and run against each applicable TypeScript project with explicit project files. Validate app and site project references and include/exclude behavior; do not assume a solution-style tsconfig reports all source files.
   - [ ] Record numeric baselines and identify implicit/explicit `any` hot spots. Set per-package no-regression minimums based on measured results, and document that type coverage is not a correctness or test coverage measure.

5. **CI, documentation, and verification**
   - [ ] Add reproducible npm scripts and lockfiles, integrating checks with `.github/workflows/2a.quality.yml` and `.github/workflows/ci.yml` without breaking package change routing or existing required checks. Keep expensive analysis in a dedicated job if needed.
   - [ ] Define which checks block versus report only, baseline ownership, how findings are resolved, and how thresholds are tightened. Upload reports as CI artifacts as appropriate.
   - [ ] Add tests for custom baseline/CI routing scripts and prove each gate fails using a controlled positive fixture, then passes without it. Avoid committing intentionally broken fixtures in analyzed source.
   - [ ] Run each new check locally and in CI; run existing package lint, tests, type checks/builds, and workflow lint as applicable. Document exact commands and exclusions in `README.md` or suitable project documentation; report any checks not run.

## Relevant files

- `api/eslint.config.js`, `app/eslint.config.js`, `site/eslint.config.js`
- `api/tsconfig*.json`, `app/tsconfig*.json`, `site/tsconfig*.json`
- Root and package `package.json` and `package-lock.json` files as needed
- New Knip and jscpd configuration files, and any narrowly scoped baseline/check scripts
- `.github/workflows/2a.quality.yml`, `.github/workflows/ci.yml`, `scripts/ci-changes.test.sh`, `.hooks/pre-commit`, `.hooks/pre-push`
- `README.md` and any existing testing or contributor documentation

## Acceptance

- [ ] Type-aware strict ESLint, SonarJS, and selected ESLint core rules run on intended TypeScript files in all three packages.
- [ ] Knip, jscpd, and type-coverage run reproducibly with documented scope and measured baselines.
- [ ] Blocking rules have demonstrated positive and negative controls; report-only findings are identified as such.
- [ ] CI routing, existing lint, tests, type checks, and builds remain functional; findings and exceptions are transparent.
