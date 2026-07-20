# Task List — 100% Test Coverage

## Progress Summary (Jul 20 2026)

| Package | Stmts | Branch | Funcs | Lines | Tests |
|---------|-------|--------|-------|-------|-------|
| API     | 82.25% | 82.54% | 90.41% | 82.25% | 548 ✓ |
| App     | 73.36% | 80.97% | 61.24% | 73.36% | 570 ✓ |

**Completed phases:** 1 (stores/utils), 2 (middleware), 3 (uncovered services), 4 (extended services), 5 (API routes), 6 (API infra: seed/migrate/provisionUser), 7 (app pages), 8 (app components), 9 (contexts/hooks)

**Remaining:** Further edge-case coverage for remaining low-coverage files

## Prerequisites

- [x] Install `supertest` + `@types/supertest` in api/ (`npm install --save-dev supertest @types/supertest --legacy-peer-deps`)
- [x] Refactor `api/src/index.ts`: extract `createApp()` factory that returns `{ app, httpServer }` without calling `start()`. Routes + middleware stay the same; only top-level `start()` call moves out.

---

## Phase 1 — Pure functions & stores

### Task 1.1 — app/stores/__tests__/collectionStore.test.ts
- [x] Test `buildCollectionTree` with flat list → returns nested tree sorted by orderValue then name
- [x] Test `buildCollectionTree` filters out archived collections
- [x] Test `buildCollectionTree` filters out inbox collection
- [x] Test `setCollections` replaces state
- [x] Test `addCollection` appends to array
- [x] Test `updateCollection` patches by id
- [x] Test `removeCollection` removes by id

### Task 1.2 — app/stores/__tests__/taskStore.test.ts
- [x] Test `setTasks` replaces state
- [x] Test `addTask` appends
- [x] Test `updateTask` patches by id
- [x] Test `removeTask` removes by id

### Task 1.3 — app/api/__tests__/queryClient.test.ts
- [x] Test `staleTime` equals 60000
- [x] Test `retry` equals 1

### Task 1.4 — app/utils/__tests__/fontLoader.test.ts
- [x] Test `ensureFontLoaded` creates a `<link>` element with correct href
- [x] Test `ensureFontLoaded` does nothing for lora
- [x] Test `ensureFontLoaded` handles hubballi
- [x] Test `ensureFontLoaded` does not duplicate link

### Task 1.5 — app/utils/__tests__/phrases.test.ts
- [x] Test `getPhrase('daily')` returns a non-empty string
- [x] Test `getPhrase('inbox')` returns a non-empty string
- [x] Test `getPhrase('upcoming')` returns a non-empty string
- [x] Test `getPhrase('monthly')` returns a non-empty string
- [x] Test `getPhrase('habits')` returns a non-empty string
- [x] Test invalid key returns undefined or throws

### Task 1.6 — api/src/config.test.ts (extend existing)
- [x] Cover remaining env var fallback branches
- [x] Test `DATABASE_URL` default
- [x] Test `REDIS_URL` default
- [x] Test `REDIS_URL_FILE` path
- [x] Test `REDIS_URL` validation in production
- [x] Test `CORS_ORIGIN` default
- [x] Test `CORS_ORIGIN` production placeholder rejection
- [x] Test `CSRF_SECRET` default in test
- [x] Test `JWT_SECRET` reads from _FILE
- [x] Test `readSecret` _FILE error path
- [x] Test `DISABLE_RATE_LIMITS_IN_DEV` when NODE_ENV unset
- [x] Test `PORT` default

---

## Phase 2 — API middleware

### Task 2.1 — api/src/middleware/__tests__/notFound.test.ts
- [x] Mock Express `req`, `res`, `next`
- [x] Call handler with any req
- [x] Verify `res.status(404).json()` called with `{ error: { code: "NOT_FOUND", message: "..." } }`

### Task 2.2 — api/src/middleware/__tests__/errorHandler.test.ts
- [x] Create `AppError` with statusCode 400, code "BAD_REQUEST", message "invalid input"
- [x] Call handler with AppError → verify `res.status(400).json()` with `{ error: { code: "BAD_REQUEST", message: "invalid input" } }`
- [x] Call handler with AppError that has `details` → verify details in response
- [x] Call handler with generic `Error("unexpected")` → verify `res.status(500).json()` with requestId, console.error called
- [x] Verify `next` is never called (error handler is terminal)

### Task 2.3 — api/src/middleware/__tests__/csrf.test.ts
- [x] `GET` request → `res.cookie()` called with `XSRF-TOKEN` (non-httpOnly, sameSite strict)
- [x] `HEAD` request → cookie set (safe method)
- [x] `OPTIONS` request → cookie set (safe method)
- [x] `POST` with matching `x-xsrf-token` header + cookie → calls `next()`
- [x] `POST` with mismatched header vs cookie → `res.status(403).json()` with error
- [x] `POST` with missing header → `res.status(403).json()` with error
- [x] `PATCH` with matching token → calls `next()`
- [x] `DELETE` with matching token → calls `next()`

### Task 2.4 — api/src/middleware/__tests__/auth.test.ts
- [x] Mock `sessionService.validateSession` to return `{ user_id: "u1", id: "s1" }`
- [x] Mock `buildCookieName` to return `"planner_session"`
- [x] Mock `shouldTouch` to return true/false as needed
- [x] Mock `touchSession` to return void
- [x] Valid session cookie → `req.userId` = "u1", `req.sessionId` = "s1", `next()` called
- [x] Missing cookie → `res.status(401).json()` with auth error
- [x] Invalid session (validateSession returns null) → 401
- [x] Session touched when `shouldTouch` returns true
- [x] Session not touched when `shouldTouch` returns false

---

## Phase 3 — API uncovered services

### Task 3.1 — api/src/services/__tests__/labelService.test.ts (DONE)
- [x] All 10 tests passing (CRUD, validation, cascade delete)

### Task 3.2 — api/src/services/__tests__/sectionService.test.ts (DONE)
- [x] All 9 tests passing (CRUD, reorder, access, cascade)

### Task 3.3 — api/src/services/__tests__/collectionService.test.ts (DONE)
- [x] All 14 tests passing (CRUD, nesting, cycle detection, inbox protection, sync events)

---

## Phase 4 — API partial coverage (extend existing test files)

### Task 4.1 — api/src/services/__tests__/authService.test.ts (DONE)
- [x] 16 tests: register/login/logout, rate limiting, password reset lifecycle, duplicate email

### Task 4.2 — api/src/services/__tests__/filterService.test.ts (DONE)
- [x] CRUD + evaluateSavedFilter + parser error handling

### Task 4.3 — api/src/services/__tests__/syncService.test.ts (DONE)
- [x] publishEvent, buildEvent, Redis failure handling

### Task 4.4 — api/src/services/__tests__/taskService.test.ts (DONE)
- [x] Recurrence, move across collections, subtask cascade, sync events

### Task 4.5 — api/src/services/__tests__/habitService.test.ts (DONE)
- [x] Streak calculation, move habit/group, completion toggle

---

## Phase 5 — API routes

### Shared setup (for all route tests)
- [x] Create a `testUtils.ts` or per-file helper:
  - Mock `authMiddleware` to set `req.userId = "test-user"`
  - Build Express app with only the route under test
  - Export `createApp(router, mountPath?)` helper

### Task 5.1 — api/src/routes/__tests__/auth.test.ts
- [x] POST /api/v1/auth/register → calls authService.register, returns 201
- [x] POST /api/v1/auth/login with missing email → 400
- [x] POST /api/v1/auth/login → calls authService.login, sets cookie, returns 200
- [x] POST /api/v1/auth/logout → calls sessionService.revokeSession, clears cookie
- [x] POST /api/v1/auth/reset-password → calls authService.requestPasswordReset
- [x] POST /api/v1/auth/reset-password/confirm → calls authService.confirmPasswordReset
- [x] POST /api/v1/auth/reset-password/confirm without token → 400
- [x] GET /api/v1/auth/me → returns user from pool.query

### Task 5.2 — api/src/routes/__tests__/tasks.test.ts
- [x] POST /api/v1/tasks → calls taskService.createTask, returns 201
- [x] PATCH /api/v1/tasks/:id → calls taskService.updateTask
- [x] POST /api/v1/tasks/:id/complete → calls taskService.completeTask
- [x] POST /api/v1/tasks/:id/reopen → calls taskService.reopenTask
- [x] PATCH /api/v1/tasks/:id/reorder → calls taskService.reorderTask
- [x] PATCH /api/v1/tasks/:id/move → calls taskService.moveTask
- [x] DELETE /api/v1/tasks/:id → calls taskService.deleteTask, returns 200

### Task 5.3 — api/src/routes/__tests__/collections.test.ts
- [x] GET /api/v1/collections → calls collectionService.listCollections
- [x] POST /api/v1/collections → calls collectionService.createCollection, returns 201
- [x] PATCH /api/v1/collections/:id → calls collectionService.updateCollection
- [x] DELETE /api/v1/collections/:id → calls collectionService.deleteCollection
- [x] POST /api/v1/collections/:id/archive → calls collectionService.archiveCollection

### Task 5.4 — api/src/routes/__tests__/labels.test.ts
- [x] GET /api/v1/labels → calls labelService.listLabels
- [x] POST /api/v1/labels → calls labelService.createLabel, returns 201
- [x] PATCH /api/v1/labels/:id → calls labelService.updateLabel
- [x] DELETE /api/v1/labels/:id → calls labelService.deleteLabel

### Task 5.5 — api/src/routes/__tests__/sections.test.ts
- [x] GET /api/v1/collections/:id/sections → calls sectionService.listSections
- [x] POST /api/v1/collections/:id/sections → calls sectionService.createSection, returns 201
- [x] PATCH /api/v1/sections/:id → calls sectionService.updateSection
- [x] DELETE /api/v1/sections/:id → calls sectionService.deleteSection

### Task 5.6 — api/src/routes/__tests__/views.test.ts
- [x] GET /api/v1/views/today → calls viewService.getTodayView
- [x] GET /api/v1/views/upcoming?days=7 → calls viewService.getUpcomingView
- [x] GET /api/v1/views/upcoming (no days) → defaults to 7
- [x] GET /api/v1/views/month?year=2026&month=7 → calls viewService.getMonthView
- [x] GET /api/v1/views/inbox → calls viewService.getInboxView
- [x] GET /api/v1/views/collection/:id → calls viewService.getCollectionView

### Task 5.7 — api/src/routes/__tests__/filters.test.ts
- [x] GET /api/v1/filters → calls filterService.listFilters
- [x] POST /api/v1/filters → calls filterService.createFilter, returns 201
- [x] PATCH /api/v1/filters/:id → calls filterService.updateFilter
- [x] DELETE /api/v1/filters/:id → calls filterService.deleteFilter
- [x] GET /api/v1/filters/:id/results → calls filterService.evaluateSavedFilter

### Task 5.8 — api/src/routes/__tests__/habits.test.ts
- [x] GET /api/v1/habits → calls habitService.listHabits
- [x] POST /api/v1/habits → calls habitService.createHabit, returns 201
- [x] PATCH /api/v1/habits/:id → calls habitService.updateHabit
- [x] DELETE /api/v1/habits/:id → calls habitService.deleteHabit, returns 204
- [x] PATCH /api/v1/habits/:id/move → calls habitService.moveHabit
- [x] PUT /api/v1/habits/:id/completions → calls habitService.toggleCompletion

### Task 5.9 — api/src/routes/__tests__/habitGroups.test.ts
- [x] GET /api/v1/habit-groups → calls habitService.listGroups
- [x] POST /api/v1/habit-groups → calls habitService.createGroup, returns 201
- [x] PATCH /api/v1/habit-groups/:id → calls habitService.updateGroup
- [x] DELETE /api/v1/habit-groups/:id → calls habitService.deleteGroup, returns 204
- [x] PATCH /api/v1/habit-groups/:id/move → calls habitService.moveHabitGroup

### Task 5.10 — api/src/routes/__tests__/comments.test.ts
- [x] GET /api/v1/tasks/:taskId/comments → calls commentService.listComments
- [x] POST /api/v1/tasks/:taskId/comments → calls commentService.createComment, returns 201
- [x] PATCH /api/v1/comments/:id → calls commentService.updateComment
- [x] DELETE /api/v1/comments/:id → calls commentService.deleteComment

### Task 5.11 — api/src/routes/__tests__/reminders.test.ts
- [x] GET /api/v1/tasks/:taskId/reminders → calls reminderService.listRemindersForTask
- [x] POST /api/v1/tasks/:taskId/reminders → calls reminderService.createReminder, returns 201
- [x] DELETE /api/v1/reminders/:id → calls reminderService.deleteReminder

### Task 5.12 — api/src/routes/__tests__/collaboration.test.ts
- [x] POST /api/v1/collections/:id/invitations → calls collaborationService.inviteToCollection
- [x] GET /api/v1/collections/:id/collaborators → calls collaborationService.listCollaborators
- [x] DELETE /api/v1/collections/:id/collaborators/:userId → calls collaborationService.removeCollaborator
- [x] POST /api/v1/invitations/accept → calls collaborationService.acceptInvitation
- [x] POST /api/v1/tasks/:id/assign → calls collaborationService.assignTask

### Task 5.13 — api/src/routes/__tests__/activity.test.ts
- [x] GET /api/v1/activity → calls activityService.listActivity
- [x] GET /api/v1/activity?collection_id=x&cursor=y → passes params

### Task 5.14 — api/src/routes/__tests__/preferences.test.ts
- [x] GET /api/v1/preferences → calls preferencesService.getPreferences
- [x] PATCH /api/v1/preferences → calls preferencesService.updatePreferences

### Task 5.15 — api/src/routes/__tests__/search.test.ts
- [x] GET /api/v1/search?q=test → calls searchService.searchEntities with query
- [x] GET /api/v1/search without q → still calls with undefined

### Task 5.16 — api/src/routes/__tests__/index.test.ts
- [x] GET /api/v1/health → returns `{ status: "ok" }"
- [x] Verify all sub-routers are mounted (by checking known routes respond)

---

## Phase 6 — API infrastructure (partial)

### Task 6.1 — api/src/db/__tests__/redis.test.ts (DONE)
- [x] 3 tests: clients defined, connectRedis calls connect on all, handles errors

### Task 6.2 — api/src/__tests__/index.test.ts (DONE)
- [x] 3 tests: health endpoint, 404 handling, error handler

### Task 6.3 — api/src/db/__tests__/seed.test.ts (smoke)
- [x] User exists → exits 0 (idempotent)
- [x] No user → creates user + collections + tasks + prefs
- [x] Transaction failure → rolls back, exits 1

### Task 6.4 — api/src/db/__tests__/provisionUser.test.ts (smoke)
- [x] Without `--production` → exits 1
- [x] `--password` flag → exits 1 (security warning)
- [x] `--password-stdin` → creates user, exits 0
- [x] `--password-file` → reads file, creates user
- [x] DB failure → rolls back, exits 1

### Task 6.5 — api/src/db/__tests__/migrate.test.ts (smoke)
- [x] All migrations applied on empty DB
- [x] Idempotent re-run (no migrations applied)
- [x] Migration failure → rolls back, exits 1

---

## Phase 7 — App pages (ALL DONE)

All 9 pages have tests: LoginPage (8 tests), HelpPage (6), MonthlyPage (4), UpcomingPage (6), InboxPage (4), CollectionsPage (4), DailyPage (4), HabitsPage (5), StyleguidePage (8), plus existing DailyPage.behavior (3) and SettingsPage (6). Total: 59 page tests.

### Task 7.1 — LoginPage.test.tsx ✓
### Task 7.2 — HelpPage.test.tsx ✓ (smoke with scroll-spy)
### Task 7.3 — MonthlyPage.test.tsx ✓
### Task 7.4 — UpcomingPage.test.tsx ✓
### Task 7.5 — InboxPage.test.tsx ✓
### Task 7.6 — CollectionsPage.test.tsx ✓
### Task 7.7 — DailyPage.test.tsx ✓
### Task 7.8 — HabitsPage.test.tsx ✓
### Task 7.9 — StyleguidePage.test.tsx ✓ (smoke)

---

## Phase 8 — App components (ALL DONE)

All components tested: QuickAdd (11), SearchOverlay (12), FilterBar (14), TaskDetail (7), Sidebar (12), AppShell (4), CollectionTreeNav (4), UI primitives (24). Total: 88 component tests.

### Tasks 8.1-8.8 — All component tests ✓

---

## Phase 9 — App contexts & hooks (ALL DONE)

AuthContext (7 tests), PlannerDragContext (8 tests), usePreferences (2 tests), useOnlineStatus (existing), useOfflineQueueReplay (existing), useSync (existing), shortcuts (existing).

### Tasks 9.1-9.3 — All context & hook tests ✓
- AuthContext 100%, PlannerDragContext 94.6%, useFloatingPosition 92%, useSync 87%
- Remaining: useTaskDrag (71.8%), useHabitDrag (68.4%) — complex drag edge cases

---

## Verification

### Final
- [x] API: 548 tests passing (62 files)
- [x] App: 570 tests passing (68 files)
- [ ] API coverage 82.25% → target 90%+ (remaining: branch edges in services)
- [ ] App coverage 73.36% → target 85%+ (remaining: date.ts, api/client.ts, drag hooks branches)
