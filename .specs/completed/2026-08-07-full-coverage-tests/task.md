# Full coverage tests — Tasks

- [x] InboxPage (app/src/pages/InboxPage.tsx): 70 tests, 98.57% stmts / 100% funcs / 100% lines
      (worktree `planner-full-coverage-tests`, branch `feat/full-coverage-tests`; remaining
      uncovered statements are defensive guards unreachable via UI, see commit a2f6145)
- [x] app/src/api/client.ts: fix + enable client.test.ts unit tests (vi.hoisted mocks, f47b1ab)
- [x] Inventory uncovered files and produce prioritized list (low->high risk)
      (API overall 87.97% stmts; lowest-risk wins taken next; remaining targets:
      routes index.ts 67%, reminderService 68%, habitService 78%, syncService 82%,
      taskService 82%, route handlers ~80-88%, dateParser 73%)
- [x] Add unit tests for api/src/services/rateLimitService.ts
      (68.18% -> 100% stmts/branches/funcs/lines, PR #111)
- [x] Add unit tests for api/src/services/authService.ts
      (90.8% -> 100% stmts/funcs/lines, 97.72% branches; one unreachable `: ''` branch,
      PR #111)
- [x] Add/extend tests for other low-coverage files discovered in inventory
      (branch `feat/test-coverage-phase2-continued`; API overall 92.12% stmts:
      preferences/reminders/collaboration routes 100%, syncService 99%, dateParser 95.45%,
      habitService 86.95%, taskService 81.39%, index.ts bootstrap 82%, migrate/seed ~91-94%
      — remaining gaps are server bootstrap (NODE_ENV!=test) and boot guards, not vitest-coverable)
- [x] Full end-to-end session lifecycle integration tests (real Postgres + Redis)
      (api/src/services/__tests__/sessionLifecycle.integration.test.ts, 4 tests green on main)
- [x] Offline queue security tests (Account A/B isolation)
      (app/src/api/__tests__/offlineQueue.accountIsolation.test.ts, 5 tests green on main)
- [x] Playwright e2e: auth, task CRUD, realtime sync, offline recovery
      (app/e2e/productionHardening.spec.ts, 5 tests; playwright.config pins chromium via
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, set in .docker/app/Dockerfile dev stage)
- [x] CI: add job(s) to run integration and e2e (nightly for e2e if needed)
      (.github/workflows/quality.yml: integration suite runs in the existing api job against
      Postgres/Redis services; new `e2e` job boots API + vite preview and runs Playwright,
      dumping server logs on failure)
- [ ] Merge PRs and update spec tasks to [x] as completed
      (open PR for feat/test-coverage-phase2-continued against main; contains the three
      phase-2 suites fixed for current main, ~537 new test lines, and the e2e CI job)

Workflow notes

- Use git worktrees per spec if major changes are required (follow Plan Mode in repository README).
- Commit tests in small PRs; run targeted vitest commands before wider runs.
- For integration tests, reuse docker compose test recipe from project quickstart.
