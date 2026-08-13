# TDD + Playwright + Test Coverage — Plan

## Goal

Raise the repo’s testing standards so every new feature or spec is developed with TDD, includes unit coverage plus integration tests where relevant, and adds Playwright e2e coverage for user-visible flows.

## Scope decisions

| # | Decision |
|---|---|
| 1 | Make TDD the default workflow for new feature and spec work. |
| 2 | Require unit coverage plus integration tests for server or data flow changes. |
| 3 | Require Playwright e2e coverage for user-facing behavior. |
| 4 | Update contributor guidance in `GEMINI`, `AGENTS`, `CLAUDE`, and `.github/instructions` surfaces so the rule is hard to miss. |
| 5 | Prefer real integration boundaries over mocks when the repository already supports them. |

## Strategy

1. Identify the current guidance files and the sections that need test-policy updates.
2. Add a concise canonical testing policy that covers TDD, coverage expectations, integration tests, and Playwright.
3. Update the agent instruction surfaces to point to the same policy language.
4. Make the policy actionable by specifying what must exist for a new feature/spec before it is considered done.
5. Keep the guidance compatible with the repo’s existing Vitest + Docker Compose setup.

## Implementation outline

### Testing policy

- For every new feature or spec:
  - write or update tests first,
  - include unit tests for pure logic and component behavior,
  - include integration tests for API, DB, or sync behavior,
  - include Playwright e2e for user-visible flows where applicable.
- Treat "no e2e needed" as an explicit, documented exception rather than the default.
- Encourage small test increments that verify behavior before implementation.

### Documentation surfaces

- Update the repo guidance files so the policy appears in the primary onboarding paths:
  - `AGENTS`
  - `CLAUDE`
  - `GEMINI`
  - `.github/instructions`
- Keep the wording consistent across those surfaces to avoid contradictory expectations.
- If a canonical testing doc is added, make the other files reference it instead of duplicating a long policy.

### Playwright

- Add or restore Playwright-based e2e support for browser-visible journeys.
- Define a minimal, stable baseline suite that covers the most important user flows.
- Make the suite runnable in CI and locally with a predictable command.
- Prefer tests that assert real app behavior rather than implementation details.

### TDD workflow

- Document the red-green-refactor cycle.
- Require tests to describe the desired behavior before implementation work begins.
- Add reviewer-friendly guidance for when a spec needs unit, integration, and e2e coverage.

## Risks / mitigations

- **Guidance drift** across multiple instruction files. Mitigate by keeping one canonical policy and making the others terse references.
- **Over-testing trivial changes**. Mitigate by requiring explicit test selection tied to user-visible risk.
- **Flaky e2e tests**. Mitigate by keeping Playwright coverage focused, deterministic, and CI-ready.

## Acceptance criteria

- The repo guidance files all instruct contributors to use TDD for new features/specs.
- The guidance explicitly requires unit, integration, and Playwright e2e coverage where appropriate.
- The policy distinguishes between required coverage and explicit exceptions.
- Playwright is called out as the browser testing tool for e2e coverage.

## Verification

- Confirm the updated guidance exists in every requested instruction surface.
- Confirm the wording consistently mentions TDD, unit tests, integration tests, and Playwright e2e.
- Confirm the policy is actionable enough for future specs to follow without ambiguity.
