# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

1. [x] Spec (`plan.md`, this file)
2. [x] Prerequisite
   - [x] PR #289 merged (happy-dom + `app/src/test/globalSetup.ts` pinning `TZ=UTC`)
   - [x] Branch `test/vitest-vm-threads` from updated `main`, worktree `../planner-vm-threads`
3. [~] Reproduce and fix errors under `--pool=vmThreads`
   - [x] Run `cd app && npx vitest run --pool=vmThreads` 10 times, collect every failing test and unhandled error
     - Flakes only in full-suite runs (never single-file): HelpPage scroll 3/10, DailyPage.behavior revert 2/10, plus ECONNREFUSED noise. All had the same root cause class.
   - [~] `HelpPage.test.tsx`: stabilize the `scrollIntoView` assertion (mock on `Element.prototype` in the test, await the scroll with `waitFor`)
     - Added `waitFor`; real fix is the systemic prototype reset in `setup.ts` (see below). Final 10x verification pending.
   - [x] Find the test that calls `127.0.0.1:3000` for real (`--reporter=verbose`, bisect by directory) and mock `fetch` or the API client
     - `AppShell.test.tsx` renders the real `useVersionCheck`, which fetches `/api/v1/version` at module scope against happy-dom's `localhost:3000`. Mocked the hook in that test.
   - [x] `OAuthConsentPage.test.tsx` and `UpdateToast.test.tsx`: confirm they pass on happy-dom, otherwise fix (cleanup, timers, module state shared across the VM context)
     - Both pass consistently under happy-dom + vmThreads; no change needed.
   - [~] Check for state shared through modules or `globalThis` that leaks under `vmThreads` (`src/test/setup.ts`, singletons like `utils/socket.ts`)
     - Root cause found: happy-dom shares element classes across files in a worker, so `scrollIntoView` stubs written on `Element`/`HTMLElement.prototype` leak between files. `setup.ts` now re-pins both prototypes to a writable no-op per file and in `afterEach`; regression test added.
4. [ ] Switch
   - [ ] `app/vitest.config.ts`: add `pool: "vmThreads"` to the `test` block
   - [ ] Consider `poolOptions.vmThreads.memoryLimit` if workers grow (known vmThreads memory leak)
   - [ ] Run the full suite 10 times locally, all green
5. [ ] Verify in CI
   - [ ] `2a. Quality / App` green 3 times in a row on the PR
   - [ ] Compare the Vitest summary duration against the happy-dom baseline (about 38s)
   - [ ] `docker compose exec app npm test` also passes (container, not only host)
6. [ ] Wrap up
   - [ ] PR with Conventional Commits, small commits per file
   - [ ] Move this spec to `.specs/completed/`
