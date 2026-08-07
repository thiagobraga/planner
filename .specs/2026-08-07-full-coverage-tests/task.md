# Full coverage tests — Tasks

- [ ] Inventory uncovered files and produce prioritized list (low->high risk)
- [ ] Add unit tests for app/src/api/client.ts (mock fetch/XHR, edge cases)
- [ ] Add unit tests for api/src/services/rateLimitService.ts
- [ ] Add unit tests for api/src/services/authService.ts
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
