# Agent Task Tool

Make every AI agent (Claude Code, Codex, Gemini, Cursor, hosted Claude) use Planner as its todo-list tool instead of private, throwaway lists. Plan and task breakdown live in this one file by request.

## What the user gets

- An agent starts a job, creates a collection for it, and files its whole plan (tasks with subtasks) in one call.
- The user watches the list fill and tick off in the Planner UI in real time, attributed to the agent (token or OAuth label already shown via `actor`).
- Several agents work in parallel without grabbing the same task or duplicating tasks on retry.
- Agents log progress and results as comments on the task.
- One install step per client (plugin / config snippet) and the agent knows when to use Planner without being told.

## Current state (verified)

- MCP at `POST /api/v1/mcp`, per-request `McpServer` (`api/src/mcp/server.ts`), write tools only for write-scope tokens.
- 17 tools: task CRUD/complete/reopen/move/reschedule, filter, search, inbox/today/upcoming, collections, labels, habits.
- Auth: personal API tokens and OAuth 2.1 for hosted clients already work.
- Missing: subtasks (`tasks` has no `parent_id`; only `collections` and `habits` do), batch ops, idempotency, comments/status/section/reminder tools, create collection, claim, activity read, skill/plugin packaging.
- `api/src/services/taskService.ts` is 1975 lines, over the 1000 limit. New logic goes in new focused modules, not in this file. Coordinate with the unpushed task-service split.

## Decisions

- Subtasks: one level only (task -> subtasks). Simplest, covers agent checklists.
- Agent session = a normal collection created by the agent. No new "session" entity.
- Claim = status `doing` + `claimed_by` label, atomic in one SQL `UPDATE ... WHERE claimed_by IS NULL`.
- Idempotency = optional `external_id` per user, partial unique index.
- Top-level views (Daily, Inbox, collection) show only `parent_id IS NULL` rows; children render nested under the parent.
- Phase 1-3 ship API + MCP. Phase 4 ships the UI for subtasks. Phase 5-6 ship distribution and safety.

## Open questions (answer before phase 1)

1. Does a collection need an archive flag for finished agent sessions, or is delete/complete enough?
2. Should completing the last open subtask auto-complete the parent, or only warn?
3. Plugin lives in this repo (`integrations/`) or a separate repo?

## Tasks

### 0. Isolation and setup

- [ ] Worktree `.worktrees/agent-task-tool`, branch `feat/agent-task-tool`, `.env`, `COMPOSE_PROJECT_NAME=planner-claude`, `bash .hooks/setup-hooks.sh`
- [ ] Draft PR against `main`

### 1. Schema and services (TDD, real DB)

- [ ] Migration `050_task_agent_fields.sql` (backward-compatible, additive only)
  - [ ] `tasks.parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE` + index
  - [ ] `tasks.external_id TEXT` + `UNIQUE (user_id, external_id) WHERE external_id IS NOT NULL`
  - [ ] `tasks.claimed_by TEXT`, `tasks.claimed_at TIMESTAMPTZ`
  - [ ] DB check: parent must have `parent_id IS NULL` (one level) and same collection
- [ ] New `api/src/services/taskBatchService.ts`
  - [ ] `batchCreateTasks(userId, items[])`: single transaction, max 50, each item may carry `subtasks[]`, `external_id` upsert-or-return-existing
  - [ ] `batchUpdateTasks(userId, patches[])`: single transaction, max 100, all-or-nothing
  - [ ] Each created/updated row calls `publishEvent()` and `recordActivity()`
- [ ] New `api/src/services/taskClaimService.ts`: `claimTask(userId, taskId, actorLabel)` returns `{claimed, by}`; `releaseTask`
- [ ] Subtask rules in `taskService.ts` call sites (minimal touch): complete parent, delete parent cascades, move parent moves children
- [ ] Types in `api/src/types/` for batch inputs and claim result
- [ ] Integration tests: batch atomic rollback, idempotent retry, double-claim race (two parallel claims, one wins), cascade delete, depth-2 rejected

### 2. Views exclude children, nest them

- [ ] `dailyService.getDailyView`, `viewService` (inbox, collection), `filterService` evaluation: add `parent_id IS NULL`, attach `subtasks[]` per parent
- [ ] `searchService`: still return subtasks, flagged with parent id
- [ ] Update `formatTaskLine` in `api/src/mcp/format.ts` to print subtasks indented with `id:<uuid>`
- [ ] Integration tests per view; no regression in existing 1101 API tests

### 3. MCP tools (`api/src/mcp/tools/`, new files, each under 300 lines)

- [ ] `collections.ts` add `create_collection` (name, optional parent)
- [ ] `tasksBatch.ts`: `batch_create_tasks`, `batch_update_tasks`
- [ ] `tasks.ts` (or new `taskDetail.ts`): `get_task` (full detail, subtasks, comments), `claim_task`, `release_task`
- [ ] `comments.ts`: `add_comment`, via `commentService`
- [ ] `statuses.ts`: `list_statuses`; `update_task` gains `status` param by name
- [ ] `activity.ts`: `list_activity` (read scope), via `activityService`
- [ ] Register in `api/src/mcp/server.ts`; write tools stay behind `write` scope
- [ ] Update `INSTRUCTIONS` in `server.ts`: "for multi-step work, create a collection and use batch_create_tasks; claim before working; comment results; complete when done"
- [ ] Tool tests via MCP client against real DB; assert read-only token does not see write tools
- [ ] Optional REST mirror `POST /api/v1/tasks/batch` (needed only for phase 5 hook), route in `routes/index.ts`

### 4. Frontend (DESIGN.md tokens: Lora, 24px rhythm, flat, accent <=10%)

- [ ] Types in `app/src/types/`; extend task type with `parentId`, `subtasks`, `claimedBy`
- [ ] `TaskItem.tsx`: nested subtask rows, progress count (`2/5`), claimed-by chip
- [ ] `useSync.ts`: patch Zustand/invalidate React Query for subtask events
- [ ] Vitest unit tests (await in `act`/`waitFor`), Playwright E2E: agent token creates batch, UI shows nested list live
- [ ] Browser check desktop + 390px, screenshots to `app/dist/screenshots/`, linked in PR

### 5. Distribution

- [ ] `integrations/claude-code/` plugin: `.claude-plugin/plugin.json`, `.mcp.json` (OAuth URL `https://planner.thiagobraga.dev/api/v1/mcp`), `skills/planner-tasks/SKILL.md`
  - [ ] Skill: when to use Planner vs built-in todo, collection naming (`agent/<repo>/<job>`), claim/comment/complete loop, never delete user tasks
- [ ] Hooks in plugin: `SessionStart` injects today + inbox summary; `PostToolUse` on `TodoWrite` mirrors via `POST /tasks/batch` using `external_id`; `Stop` closes the session collection's open claims
- [ ] Codex: `AGENTS.md` snippet + MCP config; Gemini: `GEMINI.md` snippet + `settings.json` MCP entry; Cursor: `mcp.json` snippet
- [ ] `docs/agents.md`: token vs OAuth setup, per-client copy-paste, tool reference
- [ ] Settings > Integrations page: show the snippets with a "copy" button (reuse existing token creation UI)
- [ ] Manual verify in a fresh Claude Code session: plugin installs, agent files a plan, UI updates live

### 6. Safety

- [ ] `api_tokens.collection_id` nullable; scoped token can only read/write inside that collection (enforce in `middleware/requireScope.ts` and MCP `resolve.ts`)
- [ ] Per-token rate limit via `rateLimitService`; batch size caps already in schema
- [ ] `dry_run` flag on batch tools returning what would change
- [ ] Tests: scoped token cannot touch Inbox or other collections; rate limit returns 429-shaped error

### 7. Finish

- [ ] Update `README.md`, `CLAUDE.md` (MCP section, new services), this file's checkboxes
- [ ] Run lint, build, all API + app tests, E2E; report failures plainly
- [ ] Small Conventional Commits per step with `Co-Authored-By`, push at each checkpoint, mark PR Ready

## Relevant Files

```
api/src/db/migrations/050_task_agent_fields.sql      new
api/src/services/taskBatchService.ts                 new
api/src/services/taskClaimService.ts                 new
api/src/services/taskService.ts                      touch minimally (1975 lines, do not grow)
api/src/services/dailyService.ts                     children excluded, nested
api/src/services/viewService.ts                      children excluded, nested
api/src/services/filterService.ts                    children excluded, nested
api/src/services/commentService.ts                   reused by add_comment
api/src/services/activityService.ts                  reused by list_activity
api/src/services/syncService.ts                      publishEvent on every mutation
api/src/middleware/requireScope.ts                   collection-scoped tokens
api/src/mcp/server.ts                                register tools, update INSTRUCTIONS
api/src/mcp/format.ts                                subtask lines
api/src/mcp/resolve.ts                               status/section resolution, scope checks
api/src/mcp/tools/{collections,tasks,tasksBatch,comments,statuses,activity}.ts
api/src/routes/index.ts                              optional /tasks/batch
api/src/types/                                       batch + claim types
app/src/components/TaskItem.tsx                      nested subtasks, claimed chip
app/src/hooks/useSync.ts                             subtask events
app/src/types/                                       task type extension
integrations/claude-code/                            plugin, skill, hooks
docs/agents.md                                       per-client setup
README.md, CLAUDE.md                                 doc updates
```
