# MCP Server - Tasks

## Context

- Prerequisite: `2026-10-05-api-tokens` merged (`req.authMethod`, `req.userId`, `req.tokenScopes`, bearer auth, CSRF skip for tokens).
- Mount at `/api/v1/mcp` so existing Traefik (`PathPrefix(/api)`) and Vite proxy routing work unchanged. It runs behind the global rate limiter, the 415 JSON guard, `originCheck`, `authMiddleware` and the token-aware `csrfProtection`.
- Services already take `userId` and call `publishEvent()` themselves, so tools call services directly (no HTTP round trip) and real-time sync is free.
- `requestContext` (AsyncLocalStorage) wraps every `/api/v1` request; MCP tool handlers run inside it.
- Useful existing functions:
  - `viewService`: `getTodayView(userId)`, `getUpcomingView(userId, days)`, `getInboxView(userId)`, `getCollectionView(userId, collectionId)`, `getUserTimezone(userId)`, `localDateInTimezone(now, tz)`
  - `taskService`: `createTask(userId, CreateTaskInput)`, `updateTask(taskId, userId, input)`, `completeTask`, `reopenTask`, `moveTask(taskId, userId, MoveTaskInput)`, `deleteTask`
  - `collectionService.listCollections(userId)`, `labelService.listLabels(userId)`, `searchService.searchEntities(userId, q)`
  - `filterService.evaluateSavedFilter(filterId, userId, today)` (needs an ad-hoc variant), `parsers/filterParser.parseFilter`
  - `habitService.listHabits(userId)`, `toggleCompletion(userId, habitId, date, isCompleted)`
  - `parsers/dateParser.parseDueDate(input, { now })` -> `{ date, time?, timezone?, recurrence? }`

## 1. Dependencies

- [x] 1.1 Installed `@modelcontextprotocol/sdk@^1.32.1` and `zod@^4.6.5` (pin current majors; check the SDK changelog for the Streamable HTTP API at install time)
- [x] 1.2 Confirm the build still emits ESM correctly (`npm run build`), and that the SDK's subpath imports (`@modelcontextprotocol/sdk/server/mcp.js`, `.../server/streamableHttp.js`) resolve under the API's `tsconfig`.

## 2. Types - `api/src/types/mcp.ts`

- [x] 2.1 `interface McpAuthContext { userId: string; scopes: ApiTokenScope[]; now: () => Date }`
- [x] 2.2 (changed) `McpTaskLike` instead: the formatter reads the subset every service returns. `ToolResultTask` was dropped with structured output (see 6.1). Was: `interface ToolResultTask { id; title; due: string | null; time: string | null; deadline: string | null; priority: number; collection: string; labels: string[]; completed: boolean; recurring: boolean }`

## 3. Server factory - `api/src/mcp/server.ts`

- [x] 3.1 `buildMcpServer(ctx: McpAuthContext): McpServer`
  - `new McpServer({ name: 'planner', version: BUILD_VERSION }, { instructions })` where `instructions` briefly explains collections/sections/labels, that dates accept natural language in the user's timezone, and to call `list_collections` before creating tasks in a named collection.
  - Register read tools always; register write tools only when `ctx.scopes.includes('write')`.
- [x] 3.2 Every handler wraps service calls in a `runTool()` helper that maps `AppError` to `{ isError: true, content: [{ type: 'text', text: '<code>: <message>' }] }` so the agent sees actionable errors instead of a transport failure. Unknown errors are logged and returned as `INTERNAL_ERROR` without stack traces.

## 4. Endpoint - `api/src/routes/mcp.ts`

- [x] 4.1 Stateless Streamable HTTP: on each `POST /`, build the server for `req.userId` / `req.tokenScopes`, create `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, `await server.connect(transport)`, `await transport.handleRequest(req, res, req.body)`; close both on `res.on('close')`.
- [x] 4.2 `GET /` and `DELETE /` -> `405` with `Allow: POST` (no server-initiated stream, no MCP sessions in v1).
- [x] 4.3 Reject cookie-session requests with 403 `TOKEN_REQUIRED`: MCP is for agents, and keeping browsers off it means no CSRF reasoning is needed for this route.
- [x] 4.4 Mount `router.use('/mcp', mcpRoutes)` in `routes/index.ts`.
- [x] 4.5 Scope middleware: MCP calls are always `POST`, so the global `requireScope` (from api-tokens 5.1) must exempt `/mcp`; scope is enforced by which tools get registered (3.1). Add a test that a read token can `tools/call get_today` but `tools/call create_task` returns "unknown tool".
- [x] 4.6 Body size: MCP requests are small; the global `express.json({ limit: '100kb' })` is fine. `reschedule_tasks` caps at 100 ids.

## 5. Resolution helpers - `api/src/mcp/resolve.ts` (TDD, pure where possible)

- [x] 5.1 `resolveDue(phrase, tz, now)`: `parseDueDate(phrase, { now: zonedNow })` -> `{ dueDate, dueTime, dueTimezone, recurrenceRule }`. Accept ISO `YYYY-MM-DD` too. Return a tool error listing examples on parse failure.
- [x] 5.2 `resolveCollection(userId, nameOrId)`: exact id match, else case-insensitive name match over `listCollections`; 0 matches -> error "No collection named X. Available: ..."; >1 -> error listing `name (id)` candidates.
- [x] 5.3 `resolveLabels(userId, names)`: same rules; unknown labels are reported, not auto-created.
- [x] 5.4 Unit tests for date phrases ("tomorrow", "next friday 15:00", "every monday", "2026-12-24"), timezone edge (23:30 in `America/Sao_Paulo` vs UTC), ambiguous collection names.

## 6. Formatters - `api/src/mcp/format.ts`

- [x] 6.1 (simplified) Text content only, no `outputSchema`/`structuredContent`: the one-line format already carries ids, and every client reads text. Was: `formatTasks(tasks): string` - one line per task: `- [x] <title> · due Fri 10 Oct 15:00 · p1 · #label · (Collection) · id:<uuid>`; completed tasks `[x]`. Return text content plus `structuredContent` with `ToolResultTask[]` and an `outputSchema` on each read tool so clients that support structured output get JSON.
- [x] 6.2 Truncate lists at 100 items with a trailing "...and N more, narrow with filter_tasks".
- [x] 6.3 Snapshot-style unit tests.

## 7. Tools

Each tool: `server.registerTool(name, { title, description, inputSchema, outputSchema?, annotations }, handler)`. Descriptions are written for the model: say when to use the tool and what ids look like.

### 7.1 Read tools - `api/src/mcp/tools/views.ts`, `collections.ts`, `habits.ts`
- [x] `get_today` `{}` -> `getTodayView`; annotations `{ readOnlyHint: true }`
- [x] `get_upcoming` `{ days?: int 1..30 = 7 }` -> `getUpcomingView` (the service serves 7-30 day windows; shorter asks are trimmed in the tool)
- [x] `get_inbox` `{}` -> `getInboxView`
- [x] `get_collection` `{ collection: string }` -> `resolveCollection` + `getCollectionView`
- [x] `list_collections` `{}` -> name, id, parent, shared flag
- [x] `list_labels` `{}`
- [x] `search` `{ query: string min 2 }` -> `searchEntities`
- [x] `filter_tasks` `{ query: string }` -> new `filterService.evaluateFilterQuery(userId, query, today)` extracted from `evaluateSavedFilter` (refactor, keep `evaluateSavedFilter` calling it). Parse errors returned as tool errors with the parser message.
- [x] `list_habits` `{ includeArchived?: boolean = false }` -> `listHabits` + streak + this week's completions

### 7.2 Write tools - `api/src/mcp/tools/tasks.ts`, `habits.ts`
- [x] `create_task` `{ title, notes?, due?, deadline?, priority?: 1..4, collection?, labels?: string[], type?: 'task'|'note'|'event' }` -> resolve fields -> `createTask`. Returns the formatted task.
- [x] `update_task` `{ id, title?, notes?, due?: string|null, deadline?: string|null, priority?, labels? }` -> `updateTask`
- [x] `complete_task` `{ id }` / `reopen_task` `{ id }`; annotation `idempotentHint: true`
- [x] (simplified) `move_task` `{ id, collection?, section? }` via `updateTask`; board status moves are left to the UI. Was: `{ id, collection?, section?, status? }` -> resolve -> `moveTask` with `scope` and `position` appended to the end of the destination (read how the board computes end position and reuse it)
- [x] `reschedule_tasks` `{ ids: uuid[] (1..100), due: string }` -> loop `updateTask`; report per-id success/failure; `destructiveHint: true`
- [x] `delete_task` `{ id }` -> `deleteTask`; `destructiveHint: true`
- [x] `log_habit` `{ habit: string (name or id), date?: string = today, done?: boolean = true }` -> `toggleCompletion`

## 8. Tests (TDD, real DB/Redis, no mock-DB)

- [x] 8.1 `api/src/mcp/__tests__/server.integration.test.ts`: use the SDK `Client` + `InMemoryTransport.createLinkedPair()` against `buildMcpServer(ctx)` for a seeded user
  - `listTools` for read scope excludes write tools; write scope includes all
  - each tool happy path + one error path
  - `create_task` publishes a sync event (assert via a Redis sub client or a spy on `publishEvent`)
  - cross-user isolation: user B's task id -> `NOT_FOUND` tool error
- [x] 8.2 `api/src/routes/__tests__/mcp.test.ts` (supertest over HTTP)
  - `initialize` + `tools/list` + `tools/call` with a bearer token
  - no auth -> 401 with `WWW-Authenticate`
  - cookie session -> 403 `TOKEN_REQUIRED`
  - `GET` -> 405
- [x] 8.3 Manual check with the SDK's `StreamableHTTPClientTransport` against the dev stack through the Vite proxy (create, recurring create, upcoming, today).
- [x] 8.4 E2E `app/e2e/mcpServer.spec.ts`: create token in UI, call `tools/call create_task` over HTTP, assert the task appears in the open Inbox page without reload (proves sync).

## 9. Frontend

- [x] 9.1 `ConnectAgentPanel.tsx` under the token list: MCP URL (derived from `window.location.origin + '/api/v1/mcp'`), tabs/snippets for Claude Code CLI and JSON config, copy buttons. When a token was just created, pre-fill it into the snippets inside the reveal-once panel.
- [x] 9.2 i18n strings (en, pt-BR).
- [x] 9.3 Help page entry.
- [x] 9.4 Unit test for snippet generation; screenshots desktop + narrow.

## 10. Docs

- [x] 10.1 `CLAUDE.md`: add `api/src/mcp/` to Backend architecture and Key Files; add `/mcp` to the API reference; note "every new user-facing capability should consider an MCP tool".
- [x] 10.2 README "Connect AI agents" section.

## Verification

- [x] API lint + tests, app lint + tests, E2E
- [~] Claude Code: not available in the build environment; covered by the SDK client smoke test instead. `claude mcp add --transport http planner https://planner.local/api/v1/mcp --header "Authorization: Bearer ..."`, then ask "what's on my plate today?" and "add 'test MCP' for tomorrow in Inbox" and watch the browser update live.
