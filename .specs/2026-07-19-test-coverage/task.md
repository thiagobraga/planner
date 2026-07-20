# Task List — 100% Test Coverage

## Prerequisites

- [ ] Install `supertest` + `@types/supertest` in api/ (`npm install --save-dev supertest @types/supertest --legacy-peer-deps`)
- [ ] Refactor `api/src/index.ts`: extract `createApp()` factory that returns `{ app, httpServer }` without calling `start()`. Routes + middleware stay the same; only top-level `start()` call moves out.

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

### Task 3.1 — api/src/services/__tests__/labelService.test.ts
- [ ] `listLabels` returns user's labels ordered by name
- [ ] `createLabel` valid input → inserts and returns formatted label
- [ ] `createLabel` duplicate name → throws AppError
- [ ] `createLabel` invalid name (empty, >60 chars, special chars) → throws AppError
- [ ] `createLabel` invalid color (not in palette) → throws AppError
- [ ] `updateLabel` valid input → updates and returns label
- [ ] `updateLabel` doesn't conflict with own name
- [ ] `updateLabel` conflict with other label name → throws
- [ ] `deleteLabel` → deletes task_labels associations + label itself in transaction
- [ ] `deleteLabel` non-existent id → throws 404

### Task 3.2 — api/src/services/__tests__/sectionService.test.ts
- [ ] `listSections` for collection that user has access to → returns sections ordered by order_value
- [ ] `listSections` for collection user cannot access → throws
- [ ] `createSection` valid → inserts with auto-computed order_value
- [ ] `createSection` invalid name (>120 chars) → throws
- [ ] `updateSection` name only → updates name
- [ ] `updateSection` position (reorder) → recomputes order_values for all siblings
- [ ] `deleteSection` as owner → moves tasks to parent, deletes section
- [ ] `deleteSection` as collaborator → throws 403
- [ ] `deleteSection` non-existent → throws 404

### Task 3.3 — api/src/services/__tests__/collectionService.test.ts
- [ ] `listCollections` returns owned + shared collections ordered by order_value, created_at
- [ ] `createCollection` with valid input → inserts + publishes sync event
- [ ] `createCollection` invalid name → throws
- [ ] `createCollection` invalid color → throws
- [ ] `createCollection` duplicate name per user → throws
- [ ] `createCollection` with parentId → sets parent, checks nesting depth
- [ ] `createCollection` exceeds nesting depth (max 4) → throws
- [ ] `updateCollection` as owner → updates + publishes sync event
- [ ] `updateCollection` as collaborator → throws 403
- [ ] `updateCollection` reparent creates cycle → throws
- [ ] `updateCollection` inbox cannot be renamed → throws
- [ ] `deleteCollection` as owner → cascade deletes + sync event
- [ ] `deleteCollection` inbox cannot be deleted → throws
- [ ] `archiveCollection` → sets is_archived + sync event
- [ ] `archiveCollection` inbox cannot be archived → throws

---

## Phase 4 — API partial coverage (extend existing test files)

### Task 4.1 — api/src/services/__tests__/authService.test.ts
- [ ] Register with duplicate email → throws
- [ ] Login with wrong password → throws 401
- [ ] Rate-limit: 10 failed attempts → lockout (Redis incr check)
- [ ] Rate-limit: reset after 15 minutes
- [ ] Request password reset for non-existent email → still returns ok (no info leak)
- [ ] Confirm password reset with invalid token → throws
- [ ] Confirm password reset with expired token → throws
- [ ] Confirm password reset success → updates password, removes token

### Task 4.2 — api/src/services/__tests__/filterService.test.ts
- [ ] `createFilter` with valid DSL → saves and returns
- [ ] `createFilter` invalid DSL → throws with parse error
- [ ] `listFilters` returns user's filters
- [ ] `updateFilter` → updates fields
- [ ] `deleteFilter` → removes
- [ ] `evaluateSavedFilter` → runs parser + returns results
- [ ] `evaluateSavedFilter` with no results → empty array

### Task 4.3 — api/src/services/__tests__/syncService.test.ts
- [ ] `publishEvent` with all fields → publishes to Redis pub/sub
- [ ] `publishEvent` with missing optional fields → still publishes
- [ ] Redis publish fails → logs error, doesn't throw
- [ ] `buildEvent` creates correctly shaped SyncEvent

### Task 4.4 — api/src/services/__tests__/taskService.test.ts
- [ ] Create task with recurrence → recurrence engine called
- [ ] Complete recurring task → next occurrence created
- [ ] Move task across collections → updates collectionId + sectionId
- [ ] Delete task with subtasks → cascade (or prevent based on logic)
- [ ] Remaining uncovered branch lines

### Task 4.5 — api/src/services/__tests__/habitService.test.ts
- [ ] Streak: consecutive days → correct count
- [ ] Streak: gap resets count
- [ ] Move habit to different group → updates groupId
- [ ] Move habit group → order recalculated
- [ ] Remaining uncovered branch lines

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

## Phase 6 — API infrastructure

### Task 6.1 — api/src/db/__tests__/redis.test.ts
- [ ] `redisClient`, `redisPubClient`, `redisSubClient` are Redis client instances
- [ ] `connectRedis` calls connect on all three clients
- [ ] `connectRedis` handles connection error gracefully

### Task 6.2 — api/src/__tests__/index.test.ts
- [ ] Refactor `index.ts`: extract `createApp()` function (returns `{ app, httpServer }`)
- [ ] Test `createApp()` returns Express app with Helmet, cookie-parser, CORS
- [ ] Test all route groups mounted
- [ ] Test notFound + errorHandler are last in chain
- [ ] Test CSRF protection applied to mutation routes
- [ ] Test auth routes mounted before CSRF

### Task 6.3 — api/src/db/__tests__/seed.test.ts (smoke)
- [ ] Run seed against test DB → dev user created
- [ ] Run seed again → skips (idempotent), no error

### Task 6.4 — api/src/db/__tests__/provisionUser.test.ts (smoke)
- [ ] Calling without `--production` flag → refuses
- [ ] Calling with `--production --email x@y.com --password-stdin` (mock stdin) → creates user + inbox + prefs

### Task 6.5 — api/src/db/__tests__/migrate.test.ts (smoke)
- [ ] Run migrate on empty DB → all migrations applied
- [ ] Run migrate again → no migrations run (idempotent)
- [ ] Migration failure → rolls back, exits with code 1 (verify via mock)

---

## Phase 7 — App pages (RTL)

### Task 7.1 — app/src/pages/__tests__/LoginPage.test.tsx
- [ ] Renders email + password inputs and submit button
- [ ] Submitting calls `login()` from AuthContext
- [ ] Shows error message on failed login
- [ ] Navigates to /daily on successful login
- [ ] Shows dev credentials in dev mode (if applicable)

### Task 7.2 — app/src/pages/__tests__/HelpPage.test.tsx (smoke)
- [ ] Renders all help sections
- [ ] TOC is present
- [ ] Scroll-spy updates active section (mock IntersectionObserver)

### Task 7.3 — app/src/pages/__tests__/MonthlyPage.test.tsx
- [ ] Renders month header with phrase
- [ ] "Today" button navigates to current month
- [ ] Month navigation (prev/next) updates displayed month
- [ ] MonthlyRows renders within page

### Task 7.4 — app/src/pages/__tests__/UpcomingPage.test.tsx
- [ ] Renders 7 day sections with seed data
- [ ] Days without tasks show dash placeholder
- [ ] Toggle task completion updates local state
- [ ] Indent/outdent works via keyboard

### Task 7.5 — app/src/pages/__tests__/InboxPage.test.tsx
- [ ] Fetches inbox tasks via useQuery
- [ ] Creates task via mutation (optimistic)
- [ ] Toggles task completion
- [ ] Sync event triggers refetch
- [ ] Drag-and-drop moves tasks

### Task 7.6 — app/src/pages/__tests__/CollectionsPage.test.tsx
- [ ] Fetches collection by route param
- [ ] Shows breadcrumb trail with parent collections
- [ ] Creates task in collection
- [ ] Toggles task completion
- [ ] Shows sub-collections (if any)

### Task 7.7 — app/src/pages/__tests__/DailyPage.test.tsx
- [ ] Fetches today view with overdue + today sections
- [ ] Overdue tasks appear above today tasks
- [ ] Creates task via inline form
- [ ] Toggles task completion
- [ ] Sync event updates task list

### Task 7.8 — app/src/pages/__tests__/HabitsPage.test.tsx
- [ ] Fetches habits + habit groups + preferences
- [ ] Renders timeline and calendar sub-views
- [ ] Toggle view switches between Timeline and Calendar
- [ ] Toggle habit completion
- [ ] Create/delete habit via optimistic UI

### Task 7.9 — app/src/pages/__tests__/StyleguidePage.test.tsx (smoke)
- [ ] Renders all sections without error
- [ ] Verify color swatches, typography, and at least 3 component specimens render

---

## Phase 8 — App components (RTL)

### Task 8.1 — app/src/components/__tests__/QuickAdd.test.tsx
- [ ] Renders nothing when `isOpen=false`
- [ ] Renders modal with input when open
- [ ] Typing text updates input value
- [ ] Natural date parsing shows preview (e.g., "tomorrow", "in 3 days")
- [ ] Submitting calls `onSubmit` with title and parsed date
- [ ] Escape key calls `onClose`

### Task 8.2 — app/src/components/__tests__/SearchOverlay.test.tsx
- [ ] Renders nothing when `isOpen=false`
- [ ] Renders modal with search input when open
- [ ] Empty query shows no results
- [ ] <2 chars shows no results
- [ ] 2+ chars filters tasks/collections/labels from props
- [ ] Arrow keys navigate results
- [ ] Enter selects active result
- [ ] Escape closes

### Task 8.3 — app/src/components/__tests__/FilterBar.test.tsx
- [ ] Renders input with placeholder
- [ ] Typing highlights tokens (keyword, operator, string, error)
- [ ] Shows validation error for unbalanced parentheses
- [ ] Shows validation error for consecutive operators
- [ ] Shows validation error for empty groups
- [ ] Enter calls `onApply` with valid filter string
- [ ] Clear button resets input

### Task 8.4 — app/src/components/__tests__/TaskDetail.test.tsx
- [ ] Renders nothing when `task=null`
- [ ] Shows all task fields (title, description, due date, priority)
- [ ] Editing title calls `onUpdate` on blur
- [ ] Editing description calls `onUpdate` on blur
- [ ] Priority buttons update local state
- [ ] Adding comment shows in comment list
- [ ] Delete button shows confirmation flow
- [ ] Confirming delete calls `onDelete`

### Task 8.5 — app/src/components/__tests__/Sidebar.test.tsx
- [ ] Renders navigation links (Daily, Inbox, Monthly, Habits)
- [ ] Collapsed mode shows narrow icon bar
- [ ] Expanded mode shows full drawer (220px)
- [ ] Logo/branding is present
- [ ] Settings, Styleguide, Help, Logout links present
- [ ] Logout calls `logout()` from AuthContext
- [ ] Inbox is a drop target (useDroppable)

### Task 8.6 — app/src/components/__tests__/AppShell.test.tsx
- [ ] Renders Sidebar + main content via Outlet
- [ ] Applies font class from preferences
- [ ] Applies background CSS custom properties
- [ ] Keyboard shortcut 'g+t' opens QuickAdd
- [ ] Keyboard shortcut 'g+s' opens SearchOverlay
- [ ] Keyboard shortcut '?' opens help dialog
- [ ] Dotted grid background applied when preference set

### Task 8.7 — app/src/components/__tests__/CollectionTreeNav.test.tsx
- [ ] Renders flat collection list as hierarchical tree
- [ ] Each row shows color dot + name
- [ ] Clicking name navigates to collection
- [ ] Double-click starts inline rename
- [ ] Add button creates sub-collection input
- [ ] Delete button shows ConfirmModal
- [ ] Drag-and-drop: projection shows depth indicator
- [ ] Sortable: drop reorders collection

### Task 8.8 — UI primitives
- [ ] `Checkbox` — checked/unchecked states, onChange fires, indeterminate state
- [ ] `Chip` — renders label, optional onClose fires
- [ ] `ContextMenu` — shows on right-click, items call handlers, closes on outside click
- [ ] `CustomSelect` — opens dropdown, selects option, calls onChange
- [ ] `PriorityDot` — renders correct color for P1-P4
- [ ] `Select` — renders options, calls onChange
- [ ] `StatusPill` — renders correct label for each status
- [ ] `ViewToolbar` — renders filter bar + any view actions

---

## Phase 9 — App contexts & hooks

### Task 9.1 — app/src/contexts/__tests__/AuthContext.test.tsx
- [ ] Shows loading state during initial mount (before /me resolves)
- [ ] Successful /me response → user + isAuthenticated set
- [ ] Failed /me (401) → user null, isAuthenticated false
- [ ] `login()` calls API → sets user state
- [ ] `login()` failure → throws (so LoginPage can catch)
- [ ] `register()` calls API → sets user state
- [ ] `logout()` calls API → clears user, disconnects socket
- [ ] Socket connects when authenticated
- [ ] Socket disconnects on logout

### Task 9.2 — app/src/contexts/__tests__/DragContext.test.tsx
- [ ] Drag start sets active item
- [ ] Drag move updates position
- [ ] Drag end clears active item
- [ ] Collision detection returns correct droppable

### Task 9.3 — Remaining hooks uncovered paths
- [ ] `useOnlineStatus` — online/offline events
- [ ] `useOfflineQueueReplay` — replays queued mutations on reconnect
- [ ] `usePreferences` — missing coverage if any

---

## Verification

### Final
- [ ] Run `docker compose exec api npm test -- --run --coverage` — verify 100%
- [ ] Run `docker compose exec app npm test -- --run --coverage` — verify 100%
- [ ] Confirm zero test regressions (634+ tests all green)
