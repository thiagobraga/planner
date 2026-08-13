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
- [ ] Add/extend tests for other low-coverage files discovered in inventory
- [ ] Full end-to-end session lifecycle integration tests (real Postgres + Redis)
- [ ] Offline queue security tests (Account A/B isolation)
- [ ] Playwright e2e: auth, task CRUD, realtime sync, offline recovery
- [ ] CI: add job(s) to run integration and e2e (nightly for e2e if needed)
- [ ] Merge PRs and update spec tasks to [x] as completed

Workflow notes

- Use git worktrees per spec if major changes are required (follow Plan Mode in repository README).
- Commit tests in small PRs; run targeted vitest commands before wider runs.
- For integration tests, reuse docker compose test recipe from project quickstart.
