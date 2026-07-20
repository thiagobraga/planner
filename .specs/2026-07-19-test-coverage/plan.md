# 100% Test Coverage Plan

## Goal

Achieve 100% statement, branch, function, and line coverage across both `api/` and `app/`.

## Current state

| Package | Stmts | Branch | Funcs | Lines | Tests passing |
|---------|-------|--------|-------|-------|---------------|
| API     | 82.25% | 82.54% | 90.41% | 82.25% | 535/535 |
| App     | 73.36% | 80.97% | 61.24% | 73.36% | 544/544 |

## Strategy

### Testing approach by layer

| Layer | Approach | Tool | Why |
|-------|----------|------|-----|
| **Stores, pure functions, utilities** | Unit tests | Vitest | No infrastructure needed; fast |
| **API services** | Integration tests | Vitest + real DB | Existing pattern; catches real SQL/transaction bugs |
| **API middleware** | Unit tests (mock req/res/next) | Vitest | Isolated; no DB/network needed |
| **API routes** | **Mocked services + supertest** (Option A) | Vitest + supertest | Routes are thin translation layers — test request parsing, status codes, error forwarding. Service-layer integration is already covered in Phase 3-4. |
| **API infrastructure** | Unit tests or smoke | Vitest | `seed.ts`, `provisionUser.ts`, `migrate.ts` — basic correctness only. Server entry (`index.ts`) needs `createApp` extraction. |
| **App pages** | RTL + mocked API | Vitest + jsdom | Follows existing `SettingsPage.test.tsx` pattern |
| **App components** | RTL + mocked API | Vitest + jsdom | Follows existing component test patterns |
| **App contexts** | RTL wrapper + mocked API | Vitest + jsdom | Render provider, test auth flow |

### Route testing — why Option A (mocked services)

Routes are thin: they parse the request, call one service function, return the result. They contain zero business logic. Testing them with mocked services (rather than a real DB integration) is:

- **Faster** — ~5ms vs ~500ms per test
- **Simpler** — no test DB infra needed (no global setup, no `vitest.config` changes)
- **Consistent** — every existing API test uses `vi.mock()` at module level; this doesn't introduce a new pattern
- **Sufficient** — integration between middleware and services is tested in Phases 2-4; route tests only need to verify the glue works

The only new dependency is `supertest` (devDependency in `api/`).

### Route test structure

Each route test file will:
1. Mock all services the route imports via `vi.mock("../services/xxxService.js")`
2. Build the Express app the same way `index.ts` does (or import a `createApp()` factory)
3. Mock `authMiddleware` to inject `req.userId` (to bypass real session validation)
4. Use `supertest` to fire requests
5. Assert: status code, response body shape, correct service function called with correct args, errors forwarded as expected

### Scope decisions

**Excluded from 100% target** (CLI scripts — admin/dev only, low ROI):
- `api/src/db/seed.ts` — dev-only seed script
- `api/src/db/provisionUser.ts` — admin CLI
- `api/src/db/migrate.ts` — migration runner

These get a basic smoke test but not exhaustive edge-case coverage.

**Smoke-test only** (static content, low value):
- `app/src/pages/StyleguidePage.tsx` — design reference, ~619 lines of JSX
- `app/src/pages/HelpPage.tsx` — static help text + scroll-spy

These get a "renders without error" test plus basic interaction for the scroll-spy.

## Phases

### Phase 1 — Pure functions & stores (easiest)
**Coverage bump: ~+5-8%** | **6-8 files**

| File | Current | What to test |
|------|---------|-------------|
| `app/stores/collectionStore.ts` | 0% | `buildCollectionTree` (flat→nested tree, filters archived/inbox, sorts), `setCollections`, `addCollection`, `updateCollection`, `removeCollection` |
| `app/stores/taskStore.ts` | 0% | `setTasks`, `addTask`, `updateTask`, `removeTask` — each updates state correctly |
| `app/api/queryClient.ts` | 0% | `staleTime` is 60s, `retry` is 1 |
| `app/utils/fontLoader.ts` | 0% | `ensureFontLoaded` adds/removes link tag, handles load/error |
| `app/utils/phrases.ts` | 0% | `getPhrase('daily')`, `getPhrase('inbox')`, etc. return non-empty strings |
| `api/src/config.ts` | 92.98% | Remaining uncovered branches (env var fallbacks, defaults) |

### Phase 2 — API middleware
**Coverage bump: ~+4%** | **4 files**

| File | Lines | Approach | Cases |
|------|-------|----------|-------|
| `api/middleware/notFound.ts` | 10 | Unit: mock `req, res, next` | Returns 404 JSON with correct shape |
| `api/middleware/errorHandler.ts` | 32 | Unit: mock `req, res, next` | AppError → status+code; generic error → 500+requestId; logging |
| `api/middleware/csrf.ts` | 34 | Unit: mock `req, res, next` | Safe methods set XSRF-TOKEN cookie; mutating methods validate x-xsrf-token header vs cookie; reject 403 on mismatch |
| `api/middleware/auth.ts` | 36 | Unit: mock `sessionService` | Valid cookie → sets `req.userId`; invalid → 401; missing → 401; touched session updates last_used_at |

### Phase 3 — API uncovered services
**Coverage bump: ~+12%** | **3 files**

| File | Lines | What to test |
|------|-------|-------------|
| `api/services/labelService.ts` | 215 | CRUD operations; name validation (alphanumeric + underscores, 1-60 chars); color validation (palette); duplicate name check; delete cascades task_labels |
| `api/services/sectionService.ts` | 227 | CRUD; reorder with position; owner-only delete vs collaborator list/update; access verification; tasks move to parent on section delete |
| `api/services/collectionService.ts` | 368 | CRUD; nesting depth max 4; cycle detection on reparent; inbox protection (no rename/delete/archive); sync events (buildEvent + publishEvent); collaborator-aware list |

### Phase 4 — API partial coverage
**Coverage bump: ~+3%** | **5 files (extend existing)**

| File | Current | Remaining gaps |
|------|---------|----------------|
| `authService.ts` | 52.82% | Rate-limit exhaustion (10/15min), password reset invalid token, token expiry, register duplicate email |
| `filterService.ts` | 11.64% | Most CRUD + `evaluateSavedFilter` + parser error handling |
| `syncService.ts` | 60.16% | `publishEvent` error (Redis down), missing fields |
| `taskService.ts` | 82.83% | Recurrence edge cases, move across collections, delete with dependents |
| `habitService.ts` | 71.91% | Streak calculation edges, group move edge cases |

### Phase 5 — API routes (supertest + mocked services)
**Coverage bump: ~+15%** | **16 files** | **Prerequisite: add `supertest` devDependency**

Each test file follows the same pattern:
1. `vi.mock("../middleware/auth.js")` — inject `req.userId = "test-user-id"`
2. `vi.mock("../services/xxxService.js")` — mock every service used
3. Build or import Express app (extract `createApp()` factory or build inline)
4. Each test: fire request via supertest → assert status+body+service call

| Route file | Endpoints to cover |
|------------|-------------------|
| `auth.ts` (99L) | register, login, logout, reset-password, reset-password/confirm, me |
| `tasks.ts` (73L) | create, update, delete, complete, reopen, reorder, move |
| `collections.ts` (58L) | list, create, update, delete, archive |
| `labels.ts` (43L) | list, create, update, delete |
| `sections.ts` (52L) | list (by collection), create, update, delete |
| `views.ts` (55L) | today, upcoming, inbox, month, collection/:id |
| `filters.ts` (59L) | list, create, update, delete, results |
| `habits.ts` (66L) | list, create, update, delete, move, toggle completion |
| `habitGroups.ts` (55L) | list, create, update, delete, move |
| `comments.ts` (47L) | list (by task), create, update, delete; standalone + task-nested router |
| `reminders.ts` (39L) | list (by task), create, delete; standalone + task-nested router |
| `collaboration.ts` (65L) | invite, accept invitation, list collaborators, remove collaborator, assign task |
| `activity.ts` (18L) | list with cursor pagination |
| `preferences.ts` (25L) | get, update |
| `search.ts` (17L) | search with query param |
| `index.ts` (43L) | health check, router mounts |

### Phase 6 — API infrastructure
**Coverage bump: ~+5%** | **2 meaningful files + 3 smoke tests**

| File | Lines | Approach |
|------|-------|----------|
| `api/src/db/redis.ts` | 13 | Unit: verify three clients created, `connectRedis` calls connect on all three |
| `api/src/index.ts` | 130 | **Refactor:** extract `createApp()` that returns `{ app, httpServer }` without calling `start()`. Test: middleware chain order, route mounting, CORS config |
| `api/src/db/seed.ts` | 132 | Smoke: run seed, verify dev user + collections created; skip if exists |
| `api/src/db/provisionUser.ts` | 105 | Smoke: verify `--production` flag required, password via file/stdin |
| `api/src/db/migrate.ts` | 64 | Smoke: happy path applies pending migrations; idempotent re-run |

### Phase 7 — App pages (RTL)
**Coverage bump: ~+10%** | **9 files** (7 full + 2 smoke)

| Page | Lines | Test scenarios | Exemptions |
|------|-------|----------------|------------|
| `LoginPage.tsx` | 86 | Render form, submit calls `login()`, show error on failure, redirect on success | — |
| `MonthlyPage.tsx` | 44 | Render header + MonthlyRows, month navigation buttons | — |
| `UpcomingPage.tsx` | 113 | Render seed data for 7 days, toggle task completion, indent/outdent | — |
| `InboxPage.tsx` | 307 | Fetch tasks, create task (optimistic), toggle, sync event handling | — |
| `CollectionsPage.tsx` | 376 | Fetch collection + tasks, breadcrumb trail, task CRUD | — |
| `DailyPage.tsx` | 514 | Fetch today view, overdue section, task CRUD, sync handling | — |
| `HabitsPage.tsx` | 427 | Fetch habits/groups, toggle completion, drag-and-drop, sync | — |
| `HelpPage.tsx` | 242 | Render sections + TOC, scroll-spy highlights active section | Smoke only |
| `StyleguidePage.tsx` | 619 | Render without error, verify a few key specimens render | Smoke only |

### Phase 8 — App components (RTL)
**Coverage bump: ~+8%** | **~15 files**

**Simple batch:**
| File | Lines | Test scenarios |
|------|-------|----------------|
| `QuickAdd.tsx` | 195 | Open/close, text input + live date parsing, submit calls onSubmit, Esc to close |
| `SearchOverlay.tsx` | 199 | Open/close, query filters items, keyboard navigation (arrows+enter), empty states |
| `FilterBar.tsx` | 227 | Input with syntax highlighting, validation errors (unbalanced parens, unknown tokens), clear button, onApply callback |
| `ConfirmModal.tsx` | (exists) | Confirm/cancel buttons, render message, aria attributes |

**Medium batch:**
| File | Lines | Test scenarios |
|------|-------|----------------|
| `TaskDetail.tsx` | 314 | Render task fields, edit title/desc/date/priority, add comment, subtask toggle, delete with confirmation flow |
| `Sidebar.tsx` | 243 | Collapsed vs expanded, navigation links, logout action, collection tree presence |
| `OfflineIndicator.tsx` | (exists) | Online vs offline states, reconnecting animation |

**Complex batch:**
| File | Lines | Test scenarios |
|------|-------|----------------|
| `AppShell.tsx` | 256 | Theme application, font class on root, keyboard shortcut dispatch opens QuickAdd/Search/Help |
| `CollectionTreeNav.tsx` | 528 | Tree rendering from flat list, inline rename, add sub-collection, drag projection, delete with confirm |

**UI primitives** (each 20-60 lines, 8 files):
- `Checkbox`, `Chip`, `ContextMenu`, `CustomSelect`, `PriorityDot`, `Select`, `StatusPill`, `ViewToolbar`

### Phase 9 — App contexts & hooks
**Coverage bump: ~+2%** | **~4 files**

| File | Lines | Test scenarios |
|------|-------|----------------|
| `AuthContext.tsx` | 90 | `login` calls API + sets user state, `logout` clears state + disconnects socket, loading state during init |
| `DragContext.tsx` | partial | Drag start/move/end events, collision detection, active item tracking |
| Remaining hooks (e.g., `usePreferences`) | | Uncovered return paths |

## Prerequisites

Before Phase 1:
- [ ] Install `@testing-library/dom` in app (was removed during coverage setup — already done)
- [ ] Install `supertest` + `@types/supertest` in api (Phase 5)
- [ ] Refactor `api/src/index.ts` to extract `createApp()` factory (Phase 6)

## Measurement

After each phase:
```
docker compose exec api npm test -- --run --coverage
docker compose exec app npm test -- --run --coverage
```

All 634 existing tests must remain green. Target: 100% across stmts/branch/funcs/lines.

## Constraints

- All tests pass via `docker compose exec`
- No new runtime dependencies (devDependencies only)
- Follow existing test patterns (Vitest, supertest for API routes, RTL for app)
- No backwards-compat shims — delete cleanly
- Excluded CLI scripts get smoke-only coverage
- Static pages (Styleguide, Help) get smoke-only coverage
