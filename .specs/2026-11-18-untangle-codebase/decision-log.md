# Untangle codebase - decision log

Analysis only (skill `untangle-codebase`, steps 2-3). Extras chosen: Comments, Tests. Nothing was changed in code.

Method: import graph per package (cycles, fan-in/out, orphan modules), git co-change (weak signal: history is squash-heavy), grep for special cases, and five read-only subagents per area (API task domain, API platform, app pages/components, app hooks/state, tests). Items marked **[verified]** were re-checked by hand against the code; the rest were traced by a subagent with file:line and not executed.

Size: api 13.8k lines / 117 source files, app 33.1k lines / 284 source files, 291 test files.

## 0. Bugs found along the way

The skill does not hunt bugs, but these fall out of the structural problems and are fixed by them.

| # | Bug | Where | Root fix |
|---|-----|-------|----------|
| B1 | Filters `today`, `overdue`, `due:`, `before:`, `after:` never match: `due_date` comes from `pg` as `Date`, compared with a string **[verified]** | `api/src/services/filterService.ts:182`, `filterEvaluator.ts:35-45` | F4 |
| B2 | `reorganizeTasks` count and `moveDestination.crossesDate` are wrong for the same reason | `task/reorganize.ts:73`, `task/moveDestination.ts:93` | F4 |
| B3 | `assigned to: me` compares an email with a userId | `filterEvaluator.ts:47` | F4 |
| B4 | `npm run provision-user` and `seed` insert color `'grey'`, rejected by the CHECK in migration 033 **[verified]** | `db/provisionUser.ts:30`, `db/seed.ts:36` | F9 |
| B5 | Login IP limit is effectively 10, not 20 (`max(account, ip) >= 10`) **[verified]** | `rateLimitService.ts:79-81` | F8 |
| B6 | Removed collaborator keeps receiving the collection's sync events until reconnect (no `socketsLeave`) **[verified]** | `syncService.ts:207`, `collaborationService.ts:181` | F8 |
| B7 | Offline move: synthetic `{id, ...body}` response makes `[...res.moved]` throw, UI rolls back a move that is still queued **[verified]** | `app/src/api/transport.ts:55-83`, `useTaskDrag.ts:160` | F1 |
| B8 | Reorganize schedules a day early east of UTC (`toISOString` on local midnight) **[verified]** | `app/src/hooks/useReorganize.ts:30` | F4 |
| B9 | Collections page ignores remote task/section events; Inbox ignores section events **[verified]** | `CollectionsPage.tsx:67-75`, `InboxPage.tsx:148` | F1 |
| B10 | `[`, `]`, `t` on a focused task row run both the row action and the page view shortcut (global handler ignores `defaultPrevented`) **[verified]** | `AppShell.tsx:196-212`, `TaskItem.tsx:125` | F6 |
| B11 | Daily stage menu computes from the wrong status: Daily `apiToTask` drops `statusId` | `utils/dailySections.ts:34`, `taskMenuActions.tsx:12` | F1 |
| B12 | `updateTask` with `collectionId` leaves `status_id` and descendants in the old collection; MCP `move_task` uses it | `taskService.ts:282-300`, `mcp/tools/tasks.ts:177-211` | F3 |
| B13 | Status/label events never refresh Daily: invalidations target keys no query uses (`['today']`, `['upcoming']`, `['tasks']`) | `AppShell.tsx:84-85,285-288`, `useUpdatePreferences.ts:27` | F1 |
| B14 | `validateSession` ignores `users.disabled_at`; disable only works because sessions were also revoked | `sessionService.ts:110` | F8 |
| B15 | Password reset token can be used twice concurrently (no `used_at IS NULL` guard) | `authService.ts:214-253` | F8 |
| B16 | `runOptimistic` 2s timeout reverts the UI even when the request later succeeds | `stores/optimistic.ts:43` | F1 |
| B17 | Post-commit reads inside the COMMIT try: a read failure reports an error for a write that succeeded, with no event | `task/move.ts:39-46`, `task/completion.ts:102,153,197` | F2 |

## 1. Fixes (highest leverage first)

### F1. App: one task entity cache and one list controller, used by Inbox, Collections and Daily

Inbox is a collection; it becomes `CollectionsPage` with the inbox id. Mutations, drag reconcile and sync events all patch the same React Query entries through one query-key module; pages stop copying server data into `useState`.

- `InboxPage.tsx:39-79,161-490` re-implements `useCollectionTasks.ts` and `useCollectionSections.ts` line for line **[verified]**; Inbox JSX `:551-696` mirrors `CollectionsPage.tsx:255-400` and already drifted (`text-[14px]` vs `text-sm`).
- Daily is a third copy (`useDailyTaskActions.ts`, `useDailyTaskCreate.ts`, `utils/dailyTaskMutations.ts`); delete-focus restore exists in two copies, not in Daily.
- Three `apiToTask` mappers that disagree (`InboxPage.tsx:39`, `useCollectionTasks.ts:18`, `dailySections.ts:34`) - cause of B11; two `asJournalTask` copies (`BoardColumn.tsx:20`, `DailyBoardColumn.tsx:12`).
- "Apply server move response" written three times with different fields (`useTaskDrag.ts:155-189`, `useBoardDrag.ts:545-590`, `utils/persistTaskIndent.ts:21-34`); `useTaskDrag.ts:24` needs its own `toISODate` because of the mapper mismatch.
- Three ways to copy server data into local state: setState during render (`InboxPage.tsx:120-130`), `useLayoutEffect` (`CollectionsPage.tsx:78-89`), `useEffect` (`DailyPage.tsx:57-60`).
- Sync event meaning decided per page: `AppShell.tsx:71-96`, `useDailySync.ts:29`, `InboxPage.tsx:148`, `CollectionsPage.tsx:67` - causes B9, B13; one `status` event invalidates `['collection']` up to 4 times.
- Query keys as string literals everywhere (42 `'preferences'`, 35 `'collections'`, 19 `'collection'`); invalidations of unused keys (B13).
- Window CustomEvent `'task-created'` (`AppShell.tsx:289` -> `useDailySync.ts:25`) as a hidden channel instead of a cache update.
- Five temp-id counters, `startsWith('temp-')` in 34 places across 13 files **[verified]**; `calculateMidpointOrder` 3 times (`useCollectionTasks.ts:41`, `dailyTaskMutations.ts:11`, `InboxPage.tsx:236`), gaps 1000/2000 not tied to `utils/order.ts`.
- 10-key `taskListProps` object written 4 times (`InboxPage.tsx:564`, `CollectionsPage.tsx:263`, `DailyPage.tsx:353,384`), its type inlined 5 times (`types/board.ts:55,79,118`, `types/daily.ts:49`, `types/dailyBoard.ts:18`).
- Collection submenu copied at `InboxPage.tsx:493-525`, `CollectionsPage.tsx:183-215`, `DailyOverlays.tsx:126-158` (only Daily is optimistic); stage move copied at `InboxPage.tsx:711`, `CollectionsPage.tsx:425`, `DailyPage.tsx:227-246`.
- Two optimistic mechanisms: `stores/optimistic.ts` (used only for collection recolor, itself copied 3 times: `CollectionTreeNav.tsx:147`, `useCollectionBreadcrumbs.ts:64`, `CollectionsIndexPage.tsx:246`) vs everything else; B16.
- Offline synthetic response does not match endpoint shapes (B7); `useDailyTaskCreate.ts:100,155` "keep local version" catch is unreachable for offline and leaves ghosts on real errors.
- Special cases removed by this fix: `setTimeout(0)` + document-wide `querySelectorAll` focus inside a state updater (`useCollectionTasks.ts:290`, `InboxPage.tsx:361`) **[verified]**; swallowed section rename `.catch(() => {})` (`useCollectionSections.ts:94`, `InboxPage.tsx:460`) **[verified]**; `const [, setSelectedId]` written never read (`useDailyTaskActions.ts:40`, `useCollectionTasks.ts:65`).

### F2. API: one mutation pipeline - transaction, `recordActivity` inside it, `publishEvent` after commit

A single helper (e.g. `withMutation(userId, fn)`) that services call for every write. Makes the CLAUDE.md "every mutation publishes and records" rule structural instead of a convention callers must remember.

- Missing `recordActivity`: `moveTask` (`task/move.ts:23-174`), `reorganizeTasks`, `reorderTask` (`task/ordering.ts:327-376`, also never publishes), sections, statuses, collections, labels, filters, habits (18 writes), preferences, comments, reminders, collaboration, saved colors.
- Missing `publishEvent`: comments (`commentService.ts:83,98,122`), reminders (`reminderService.ts:76,107`), `savedColorService.addSavedColor`, collaboration accept/remove/`assignTask`; `SyncEntityType` lists `comment`/`reminder` but nothing emits them.
- Status changes that complete/reopen tasks emit only a status event (`statusService.ts ~462, ~557`).
- Fire-and-forget `.catch(console.error)` wrapper copied 6 times (`task/events.ts:6`, `statusService.ts:26-43`, `collectionService.ts:8-24`, `labelService.ts:38-52`, `habitService.ts:58`, `preferencesService.ts:371`) around a `publishEvent` that logs and rethrows (`syncService.ts:107-111`).
- Activity ownership split: `syncCompletionToStatus` records (`completionSync.ts:57,68`), `syncStatusToCompletion` does not, so `completion.ts:84,135,180` record by hand.
- B17.
- Request context: `syncService.ts:7` and `activityService.ts:4` import `middleware/` to read AsyncLocalStorage (stable services depend on volatile middleware); move the store to a plain `context/` module. Calls outside a request silently lose attribution.
- `SyncEvent` defined in `syncService.ts:20` and copied by hand in `app/src/hooks/useSync.ts:4`; CLAUDE.md copy is stale (`'project'`). Put it in `api/src/types/` and share (see F10).

### F3. API: one structural-change path for tasks plus shared task SQL

- `updateTask` re-implements reparenting (`taskService.ts:204-260,355-378,415-434`) vs `moveDestination.ts:46-66`, with different error codes; B12. MCP `reschedule_tasks` loops `updateTask` and does not cascade due dates or `task_order` rows (`mcp/tools/tasks.ts:225-240`).
- `reorderTask` + `PATCH /tasks/:id/reorder` unused by the app: third copy of renumbering. Splice-and-x1000 also in `sectionService.ts:154-172`, `statusService.ts:393-410`; `createSection` uses `MAX+1` instead of the gap convention -> one `renumberSiblings`.
- MAX_DEPTH block copied 3 times with hardcoded `5` (`taskService.ts:70,218,239`); collection depth `4` twice (`collectionService.ts:115,171`).
- Collaborator access predicate in 20+ queries (`taskService.ts:89,282`, `task/access.ts:29`, `reorganize.ts:34`, `sectionService.ts:25-60`, `statusService.ts:54-88,445,534`, `viewService.ts:198`, `filterService.ts:191`, `searchService.ts:62,71`); recursive descendants CTE in 8 places; label insert 3 times; inbox lookup twice.
- Two `formatTask` (`task/format.ts:4`, `viewService.ts:36-60`); `StatusRow` and `formatStatus` copied in `viewService.ts:15-28,89-101`.
- Validation split: `utils/taskValidation.ts` runs only in the route, so MCP create/update skip date/time/recurrence checks; title/priority/type validated twice with different messages (`taskValidation.ts:88-107` vs `task/validation.ts:112-131`). Validate once in the service.
- Manual cascades duplicating FK cascades (`taskService.ts:444-461`, `collectionService.ts:311-318`, `deleteSection`).
- Section ownership never checked against the collection (`moveDestination.ts:76-82`).

### F4. Dates: parse DATE once at the pg boundary, one date module per package

- API: `pg.types.setTypeParser(1082, v => v)` in `db/pool.ts` **[verified absent]** fixes B1-B2 and removes special cases at `dailyService.ts:52`, `recurrenceEngine.ts:11-14`, `accountService.ts:33`, `viewService.ts:151`, `mcp/format.ts:14` (local getters vs UTC `toISOString`, agree only on a UTC server) and `string | Date` in `types/task.ts:19`.
- API: timezone helpers (`getUserTimezone`, `localDateInTimezone`, `addDaysISO`) live in `viewService.ts:107-152` and are imported by `task/completion.ts:9`, `mcp/resolve.ts:5`, `routes/dates.ts:3`; move to a date module. Filter route computes "today" in UTC (`routes/filters.ts:51`), MCP in the user's zone (`views.ts:142`): let the service compute it. Pass-throughs: `toolkit.ts:36`, `resolve.ts:15 todayFor`.
- App: ISO-day parse written 7 times (`dailySections.ts:29`, `dateQuickOptions.ts:32`, `viewRange.ts:44`, `DateNav.tsx:12`, `dayColumns.ts:17`, `useReorganize.ts:35`, `date.ts:70`), add-days 4 times; B8. `utils/date.ts` owns both. `MonthlyView.tsx:13` uses local `new Date()` instead of `prefs.timeZone`.

### F5. App: one drag engine

Owns snapshot, a11y announcements, temp-row guard, move tracking (`moveEcho`), API call, reconcile, rollback. Each hook supplies `resolve`, `applyLocally`, `reconcile`.

- Lifecycle repeated in `useTaskDrag.ts:45-47,133,153`, `useBoardDrag.ts:434,508,544`, `useHabitDrag.ts:53,182,207,245,250`.
- `useHabitDrag.ts:55-56,95,121` keeps its own indent tracker that the provider split out to fix drift (`PlannerDragContext.tsx:140`); unrounded offset at `:156,190`.
- a11y messages built twice in `useBoardDrag.ts:470,521`; translated in some places, hardcoded English elsewhere (pt-BR ships).
- `trackMove()`/untrack call-order rule (`utils/moveEcho.ts:30`) and its module global with a test seam.

### F6. App: one command registry (id, keys, label, handler) behind shortcuts, menus and help

- Global handler ignores `defaultPrevented` (B10).
- Shortcuts help panel hand-written in `AppShell.tsx:325-344`, missing `v t`/`v c`; Help content stale (`i18n/helpContent.ts:106-118`: `G M` monthly has no binding, arrow navigation not implemented, Enter described wrong).
- `task:editSelected`, `task:confirmDelete` bound (`shortcuts.ts:106-107`) but unhandled.
- View-shortcut parsing copied in `BoardPageToolbar.tsx:19-23`, `DailyToolbar.tsx:17-25`, `HabitsToolbar.tsx:31-35`; `ViewMenu.tsx:16,86` repeats `shortcuts.ts:114-118`; `DailyOverlays.tsx:46-106` re-lists ViewMenu options.

### F7. App: one preferences module (query, ordered optimistic patch, dependent views)

- Four write paths: `usePatchPreferences.ts` (module globals `inFlight`/`latest`), `useUpdatePreferences.ts`, `useTaskVisibilityPreferences.ts`, inline in `ui/ThemeSwitcher.tsx:28-43`. Saves from different paths can land out of order; error path restores `previous` over a newer in-flight patch.
- Inline `useQuery(['preferences'])` in `ThemeSwitcher.tsx:25`, `TopBarMenus.tsx:21`, `AppShell.tsx:57`, `SettingsPage.tsx:339`.
- Theme list 3 times (`SettingsPage.tsx:62`, `ThemeSwitcher.tsx:12`, `AppShell.tsx:33`), font list twice.
- Habits view in localStorage (`HabitsPage.tsx:33-41`) while every other page uses preferences.
- `types/daily.ts:4` imports `useDailyView` for a `ReturnType`, creating the cycle `usePatchPreferences -> useDailyView -> types/daily -> api/tasks -> api/client`.

### F8. API: one credential module and one keyed rate limiter

- `hashToken` lives in `sessionService`, SHA-256 rewritten in `authService.ts:181,210`, `collaborationService.ts:42`, `rateLimitService.ts:73,129,142`.
- check-touch-swallow triplicated (`needsTouch`, `tokenNeedsTouch`, `grantNeedsTouch`; callers `middleware/auth.ts:54,85,127`, `syncService.ts:89`).
- Revoke-all trio 4 times (`accountService.ts:263`, `adminUserService.ts:182,209`, inline `authService.ts:255-262` which hard-DELETEs); B14, B15.
- "write implies read" normalized 3 times; `plnr_oat_` must be tested before `plnr_` with nothing saying so (`auth.ts:105`); bearer check 4 times, `/mcp` path 3 times.
- Rate limit: login checked twice (`routes/auth.ts:76`, `authService.ts:112`); B5; key building 3 times; key patterns hardcoded in `adminStatsService.ts:126`; fake request `{} as never` (`:110,117`); test-only exports; never-reset `memFallbackActive`; un-unref'd `setInterval` (`:37`).
- Socket rooms snapshot at connect (B6); dead socket handlers `syncService.ts:212-234` and unused `getIO`.
- Wrong-password logins never reach the security log; `sessionRevoked` reused for unrelated events.

### F9. API: one user-bootstrap function

- User + Inbox + preferences inserted in `authService.ts:79-95`, `db/provisionUser.ts:25-38`, `db/seed.ts:34-37` (also the `db -> services` import edges); B4; `provisionUser` conflict path inserts the Inbox under a fresh uuid.

### F10. API/app contract: one source for shared values

Hidden links across the two packages, nothing ties them:
- `SyncEvent` (`syncService.ts:20` vs `app/src/hooks/useSync.ts:4`).
- Password rules with different blocklists (`passwordService.ts:17` vs `app/src/components/PasswordRequirements.tsx:3-12`).
- CSRF cookie names (`app/src/api/transport.ts:13`), token expiry options (`app/src/types/apiToken.ts:3`), palette colors (`app/src/api/collections.ts:8`).
Options: a small `shared/` contracts folder imported by both, or expose rules from the API (e.g. `/auth/password-rules`). Needs a decision.

### F11. Smaller structural fixes

- Route handlers: 90 `catch (err) { next(err) }` blocks; Express 5 already forwards rejections. `/me` runs raw SQL with dynamic `pool` import (`routes/auth.ts:186`); `/statuses/seed` seeds labels in the route.
- `errorHandler.ts:11` mints a requestId unrelated to `X-Request-Id`; CSP `reportUri` has no route (`index.ts:41`).
- Board column body identical in `BoardColumn.tsx:20-42` / `DailyBoardColumn.tsx:12-34`; only Daily has the double-submit guard. `'migrate'` column special-cased 6 times; `onOrganize` chain dead.
- Layout/style mapped to old view names and back (`useBoardPreferences.ts:11-14`, `InboxPage.tsx:563`, `CollectionsPage.tsx:262`).
- `TaskList` has three drop-target descriptions (`TaskList.tsx:72-76`), one per caller.
- `ui/` primitives fetch data (`ThemeSwitcher`, `ColorPickerPopover.tsx:95-111`); ColorPicker hardcodes beige hex (`:361,371,450`).
- 400ms long-press copied 3 times; collection color dot markup 11 times.
- Styleguide draws its own calendar and task row instead of the real components; copies hex for 2 of 5 themes.
- `SettingsPage.tsx` (873 lines) hand-rolls a timezone combobox although `CustomSelect` exists.
- Types outside `types/` (both packages): `viewService.ts:9-34`, `sectionService.ts`, `filterService.ts`, `collectionService.ts`, `searchService.ts`, `authService.ts:17`, `useBoardDrag.ts:13-44`; `types/daily.ts:1` imports `viewService`; `types/board.ts:5` imports the `TaskList` component (cycle with `utils/boardColumns.ts`).
- UUID regex 4 times, active-session SQL predicate 5 times, `/auth` CSRF exemption 3 times.

## 2. Surplus (delete)

- App files with no non-test importer **[verified]**: `components/TaskDetail.tsx` (429), `components/CollectionTreeNav.tsx` (354), `components/collections/SortableCollectionRow.tsx` (164, only used by CollectionTreeNav), `components/FilterBar.tsx` (212), `components/board/StatusTaskList.tsx`, `stores/taskStore.ts`, `utils/phrases.ts`, `utils/collectionCollapseStorage.ts`; their types (`TaskDetailProps`, `FilterBarProps`, `StatusTaskListProps`, `SharedTaskListProps`). Deleting `SharedTaskListProps` breaks the `types/board.ts` cycle.
- App dead exports: `api/labels.ts` (whole module), `fetchStatuses`, `apiArchiveCollection`, `useCollectionStore` (keep `buildCollectionTree` in `utils/`), `applyOptimistic`/`revertOptimistic`/`removeById`, `applyProjection`, `applyIndent`, `formatWeekRangeLabel`, `isChord`.
- App speculative params: `useReorganize` `onPreview`/`onRevert` (always `undefined`), `MonthlyView.onMonthChange`, `columnDeleteMessage` default, `useDailyTaskCreate` takes `dateFormat` and `prefsRef` for the same value.
- App pass-throughs: `ContextMenu.tsx:21-26`, `useTaskVisibilityPreferences` returning its argument, `updateSections` wrapper, `onToggle={(id) => handleToggle(id)}`, `groupsLoaded = habitsLoaded`, commented-out menu items `InboxPage.tsx:718-722`.
- API dead code: `searchService.applySearch`/`matchesQuery` (JS copy of SQL ILIKE), `passwordService.generateResetToken`, `sessionService.findValidSessionByUserId`, `reminderService.fetchDueReminders`/`markReminderFired`/`autoScheduleForTaskDue` (no scheduler exists), `securityLog.sessionExpired` and `backup*`, unused event types, `getIO`, dead socket handlers, `PATCH /tasks/:id/reorder` + `reorderTask`.
- API params: `syncStatusToCompletion(userId)` unused; `includeDescendants` flag for one caller.
- Docs drift: CLAUDE.md lists `stores/taskStore.ts` and `stores/authStore.ts` (absent), socket `{ auth: { token } }` (sockets use the cookie), `SyncEvent.entityType 'project'`.

## 3. Comments

- Restating comments are concentrated in: `api/src/services/taskService.ts:62,65,88,457,460,463`, `task/completion.ts:83,134,179`, `task/ordering.ts:351,354,357`, `sectionService.ts:78,90,144,152,188,209,215`, `// GET /api/v1/...` headers in `routes/statuses.ts` and `routes/sections.ts`, `api/src/index.ts:28,55,98,148,154,157,160`, `collaborationService.ts:112,149,193,230`, `app/src/components/ui/ContextMenu.tsx:22,53,151,154,159,307,311,337`, `useCollectionSections.ts:18,24`, `DailyPage.tsx:65`, `useReorganize.ts` ("Generate YYYY-MM-DD from date"), `useFloatingPosition.ts:59,63`. Pattern: "If X, do X" above a one-line branch. Remove.
- Wrong or stale: `stores/optimistic.ts:19` ("Replace a task" on a generic helper), `types/hooks.ts:1-2` (migration note, has an em dash), `utils/date.ts:1-2` (says the shift bites west; it is east, see B8), `collectionService.ts` "sections cascade via FK" then deletes them anyway.
- Keep: the WHY comments in `task/moveSubtree.ts`, `task/moveDestination.ts`, `task/ordering.ts`, most of the platform layer.

## 4. Tests

Structural fixes behind most problems:

- **Real-DB fixtures** (`api/src/test/fixtures.ts`: user, collection, task, cleanup). 37 API test files mock `db/pool` or `db/redis` **[verified count]**, against CLAUDE.md's no-mock-DB rule: scripted SQL replies (`statusService.test.ts` 148 `mockResolvedValueOnce`), 23 assertions on SQL text (`labelService.test.ts:55`). This is why B1 went unnoticed (`filterService.test.ts:148` mocks `due_date: null`). Keep the deliberate Redis-down tests (`rateLimitService.test.ts:114-181`).
- **Test the real app**: export the app factory from `api/src/index.ts`; route tests become supertest with real auth/DB. `security.test.ts:70-160` builds a copy of the app, so header tests pass even if production drops a header; `testUtils.ts:5-24` forces `req.userId`, making 22 `vi.mock('middleware/auth')` no-ops; 70 "-> calls X" passthrough tests.
- **One page harness** mocking only `api/client` and `utils/socket` (as `DailyPage.behavior` already does), shared parameterized suite for list behavior across Daily/Inbox/Collections (same tests exist in 3 files: contenteditable add field, create on blur, blank section name).
- **Shared builders** in `app/src/test/`: 74 inline task literals in 44 files, `makeTask` copied 3 times.
- **Query by role/name/data attribute**: 42 `toHaveClass` + 82 class selector assertions (`TopBar.test.tsx:88` asserts class order, `TaskDatePickerPanel.test.tsx:56` asserts `w-[280px]`).
- **Fake clocks, `expect.poll`**: `e2e/dailyListPastDays.spec.ts:10` skips on Sundays; `waitForTimeout` in `e2e/fixtures/drag.ts:40,45,83,96`; sleeps in `provisionUser.test.ts:48`, `LoginPage.test.tsx:58`.

REMOVE:
- `app/src/components/__tests__/AppShell.sync.test.ts` (tests its own copy of the handler, never imports AppShell **[verified]**).
- `api/src/services/__tests__/sessionLifecycle.test.ts` (can't fail; real coverage in the integration test), `authorization.property.test.ts` (pool always returns no rows), `sessionService.test.ts:59-63,189-196`, `taskService.property.test.ts:100-115` (`fc.constant('')`, 1 run), `db/__tests__/redis.test.ts:18-25`, `HabitTimeline.test.tsx:124`.
- `security.test.ts:340-370` (duplicates `index.test.ts:122-149`), `views.test.ts` (covered by integration), `taskService.move.status.test.ts:125` (covered by `statusTransitions.integration`).
- Tests of dead code: `taskStore`, `TaskDetail`, `CollectionTreeNav`, `FilterBar`, `StatusTaskList`, `phrases`.
- Stale mocks: 8 `vi.mock('utils/phrases')`, `App.test.tsx:24` (`MonthlyPage` no longer exists).

REWRITE:
- 32 mock-pool service tests and `adminAuth`, `seed`, `migrate`, `provisionUser` tests -> real DB.
- 18 route files with passthrough tests and `security.test.ts` header tests -> real app.
- `DailyPage.*`, `InboxPage.*`, `CollectionsPage*`, `HabitsPage*`, `App.test.tsx` -> one harness without child/router/react-query mocks.
- `AppShell.test.tsx:135` (asserts a query key on a mocked client) -> assert a refetch.
- Class assertions in `TopBar`, `HabitTimeline`, `primitives`, `TaskDatePickerPanel`, `TaskItem`, `InboxPage.sections:265`, `CollectionsPage:438`.
- ~12 `try { ...; expect.fail() } catch` -> `rejects.toMatchObject`.
- `collision.test.ts` (8 `eslint-disable no-explicit-any`) -> typed fakes; `productionHardening.spec.ts:62` named "cross-account isolation" but only checks the logged-out redirect.

## 5. Suggested order

1. Delete surplus (section 2) and the dead tests: zero behavior change, shrinks what the rest touches.
2. F4 DATE parser (+ regression tests on real DB for B1-B3): small, fixes real user-facing bugs.
3. F2 mutation pipeline and F10 shared `SyncEvent`: the API contract the app relies on.
4. F1 entity cache + list controller (Inbox merges into Collections), then F5 drag engine and F7 preferences on top of it.
5. F3, F8, F9 on the API side; F6 command registry.
6. Tests last (section 4), per the skill: they are the safety net during 1-5.
