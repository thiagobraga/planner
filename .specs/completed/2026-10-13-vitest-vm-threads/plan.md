# Faster app tests with vmThreads

## Problem

The app test suite (147 files, 1314 tests) takes about 38s locally after PR #289 moved it to happy-dom. Most of that is per-file environment setup. Running it before every push and in CI slows everyone down.

## Goals

- App suite runs in about 15s instead of about 38s, locally and in CI.
- No test is flaky or fails only under the faster mode.
- Test isolation between files is kept.

## User-visible behavior

None for app users. Developers see `npm test` finish in roughly 15s and the "environment" share of the Vitest summary drop.

## Context (measured on `main`, 8 cores)

| Setup | Time | Result |
| --- | --- | --- |
| jsdom, default pool | 64s | 7 Daily failures (timezone, fixed in #289) |
| happy-dom, default pool (after #289) | 38s | all pass |
| happy-dom + `--pool=vmThreads` | 14-17s | pass, or 1 flaky failure |
| `--no-isolate` | 64s | 409 failures, state leaks between files (rejected) |

With jsdom, `--pool=vmThreads` also broke 7 more tests (`OAuthConsentPage`, `UpdateToast`). Those came from jsdom running inside the VM context and mostly disappear on happy-dom, but this must be re-verified before switching.

## Errors to fix before switching

These appear only or mostly under `vmThreads` and must be fixed, not skipped:

- `HelpPage.test.tsx` "scrolls to section when TOC link is clicked": flaky, `scrollIntoView` mock not called with `{ behavior: 'smooth' }`.
- `Error: connect ECONNREFUSED 127.0.0.1:3000` printed as an unhandled error: some test does a real network call. Find it and mock it.
- Re-check `OAuthConsentPage` and `UpdateToast` (failed on jsdom + vmThreads) and `DailyPage.*` on the final setup.

## Decisions

- Depends on PR #289 (happy-dom and `TZ=UTC` global setup) being merged first.
- Keep per-file isolation. `isolate: false` is rejected.
- Switch only when the suite passes 10 consecutive local runs and 3 consecutive CI runs with `vmThreads`.
- If a test cannot be made stable, keep it out of the VM pool with a dedicated project instead of dropping `vmThreads` for everyone.

## Relevant Files

- `app/vitest.config.ts`
- `app/src/test/setup.ts`
- `app/src/test/globalSetup.ts`
- `app/src/pages/__tests__/HelpPage.test.tsx`
- `app/src/pages/__tests__/OAuthConsentPage.test.tsx`
- `app/src/components/__tests__/UpdateToast.test.tsx`
- `.github/workflows/2a.quality.yml`
- `.hooks/` (pre-push runs the app suite)
