# Open questions (asked together at the next stop)

1. Enable the `planner` MCP for this project (`/mcp`, select `planner`, Enable, authorize with write scope) so slice cards can be created in collection `5a0f4e37-...`. Until then progress is tracked only in `task.md`.
2. Panel and six-subtask card mock approval (STOP 1).
3. Docs-only PRs (#461) can never merge: the `main` ruleset requires `CI gate`, but `ci.yml` `paths-ignore` skips `**.md` and `.specs/**`, so no check runs. Options: merge #461 with admin bypass once, or a small `ci` PR that makes the gate job always report (path filter inside the job instead of `paths-ignore`). Recommended: the second, done as its own slice.
4. Postgres 16 to 18 maintenance window (STOP 2).
