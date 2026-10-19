# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [x] Prerequisite
   - [x] PR #289 merged (happy-dom + `app/src/test/globalSetup.ts` pinning `TZ=UTC`)
   - [x] Branch `test/vitest-vm-threads` from updated `main`, worktree `../planner-vm-threads`
3. [x] Reproduce and fix errors under `--pool=vmThreads`
   - [x] Run `cd app && npx vitest run --pool=vmThreads` 10 times, collect every failing test and unhandled error
     - Flakes only in full-suite runs (never single-file): HelpPage scroll 3/10, DailyPage.behavior revert 2/10, plus ECONNREFUSED noise. All had the same root cause class.
   - [x] `HelpPage.test.tsx`: stabilize the `scrollIntoView` assertion (mock on `Element.prototype` in the test, await the scroll with `waitFor`)
     - Added `waitFor`; real fix is the systemic prototype reset in `setup.ts` (see below).
   - [x] Find the test that calls `127.0.0.1:3000` for real (`--reporter=verbose`, bisect by directory) and mock `fetch` or the API client
     - `AppShell.test.tsx` renders the real `useVersionCheck`, which fetches `/api/v1/version` at module scope against happy-dom's `localhost:3000`. Mocked the hook in that test.
   - [x] `OAuthConsentPage.test.tsx` and `UpdateToast.test.tsx`: confirm they pass on happy-dom, otherwise fix (cleanup, timers, module state shared across the VM context)
     - Both pass consistently under happy-dom + vmThreads; no change needed.
   - [x] Check for state shared through modules or `globalThis` that leaks under `vmThreads` (`src/test/setup.ts`, singletons like `utils/socket.ts`)
     - Root cause found: happy-dom shares element classes across files in a worker, so `scrollIntoView` stubs written on `Element`/`HTMLElement.prototype` leak between files. `setup.ts` now re-pins both prototypes to a writable no-op per file and in `afterEach`; regression test added.
   - [x] `DailyPage.behavior.test.tsx` "restores the task when the completion request fails": measured under CPU load, the `catch -> setState` restore reaches RTL's assertion in 439-989ms, so the default 1s poll window flaked on busy machines. Widened to `{ timeout: 4000 }` (same as the existing AuthContext precedent).
4. [x] Switch
   - [x] `app/vitest.config.ts`: add `pool: "vmThreads"` to the `test` block
   - [x] Consider `poolOptions.vmThreads.memoryLimit` if workers grow (known vmThreads memory leak)
     - Vitest 5 has no `poolOptions.vmThreads.memoryLimit`; the top-level `vmMemoryLimit` exists and is left unset, no worker memory growth observed.
   - [x] Run the full suite 10 times locally, all green
     - 12 green runs with the fixes (1365 tests), then 10 green runs of `docker compose exec app npm test` on the final tree (153 files / 1367 tests, 20.3-41.5s under host load). Earlier final 10x: 1 failure traced to the waitFor window, fixed and fully re-verified after.
5. [x] Verify in CI
   - [x] `2a. Quality / App` green 3 times in a row on the PR
     - CI run 39003532457 attempts 1-3 on the app-code commit, all green (App job 1m3s each).
   - [x] Compare the Vitest summary duration against the happy-dom baseline (about 38s)
     - CI, same runner fleet: main/forks 56.95s (environment 39%) vs vmThreads 22.80s (environment 2%). Local: 19-29s typical vs ~38s baseline.
   - [x] `docker compose exec app npm test` also passes (container, not only host)
     - That is exactly the command the final 10x loop ran; also part of pre-push (lint + test + build, 93s).
6. [x] Wrap up
   - [x] PR with Conventional Commits, small commits per file
   - [x] Move this spec to `.specs/completed/`
