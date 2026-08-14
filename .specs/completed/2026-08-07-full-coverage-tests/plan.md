# Coverage — Full Blaster

Goal: raise test coverage to cover all files and features (target: 98–100% statements/lines across app + api), close Phase 2 deferred items, and add e2e coverage for real-world flows.

Strategy

1. Inventory uncovered files and prioritize by risk/usage.
2. Add focused unit tests for low-coverage modules (api client, rateLimitService, authService, others).
3. Add integration tests that require real Postgres + Redis for session lifecycle and offline queue isolation.
4. Implement Playwright e2e suite to exercise full user flows (auth, create/edit tasks, realtime sync, offline recovery).
5. Update CI to run unit+integration+e2e (e2e optional on nightly or separate job), and enforce coverage gates gradually.

Acceptance criteria

- App and API coverage >= 98% statements or explicit list of exempt files with justification.
- Integration tests for session lifecycle and offline queue merged and passing in CI.
- Playwright flows cover login, task CRUD, sync, and offline recovery.

Notes

- Integration tests run against ephemeral docker compose (use existing compose setup).
- Seek iterative progress: land unit tests first, then integration, then e2e.
- Create separate PRs per major area (api unit tests, app unit tests, integrations, e2e) for review.
