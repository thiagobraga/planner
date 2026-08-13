# Dedicated interface files — Tasks

Source plan: `plan.md`.

Pure refactor: move every interface/type out of implementation files into
dedicated per-domain type files. No behaviour change, no re-export shims —
importers get updated `import type` paths in the same milestone. Tests keep
their local mock interfaces. `.d.ts` files, `test/setup.ts`, and
`i18n/types.ts` stay as-is (see plan Exceptions).

Naming rule for central-file collisions: rename the narrower/local shape with
a domain prefix (e.g. `ViewTaskRow`, `TaskComment`, `StoreTask`) — never merge
different shapes.

## Milestone 1 — app API contracts (`app/src/types/api.ts`)

- [ ] Create `app/src/types/api.ts` with all 24 contract types from
      `app/src/api/client.ts` (JSDoc moves with each type): `ValidationDetail`,
      `UserRole`, `AuthUser`, `ApiTask`, `Preferences`, `TaskMoveInput`,
      `MovedTaskSummary`, `TaskMoveResponse`, `ApiCollection`,
      `CollectionView`, `ApiSection`, `ApiHabit`, `ApiHabitGroup`,
      `HabitsResponse`, `HabitMoveInput`, `HabitMoveResponse`,
      `HabitGroupMoveInput`, `HabitGroupMoveResponse`, `AdminUser`,
      `AdminUserList`, `AdminCounts`, `AdminHealth`, `AdminAuthStats`
      (`TaskOrderScope` stays in `types/drag.ts`; `TaskMoveInput` imports it
      from there)
- [ ] Strip all type declarations from `api/client.ts`; keep only fetch
      functions
- [ ] Rewrite every `import { type X } from '../api/client'` /
      `import type { X } from '../api/client'` to `import type { X } from
      '../types/api'` (grep `api/client` in `app/src` for the full list, incl.
      tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): move API contract types to src/types/api.ts`

## Milestone 2 — task domain (`app/src/types/tasks.ts`, `types/stores.ts`)

- [ ] Create `app/src/types/tasks.ts`:
      `Task`, `TaskItemProps` (TaskItem); `TaskCallbacks`, `TaskListProps`
      (TaskList); `TaskComment` (renamed from TaskDetail's `Comment`),
      `TaskDetailProps`; `TaskBlockPreviewProps`; `TaskVisibilityControlsProps`;
      `DaySection` (DailyPage); `StoreTask` (taskStore's private `Task`),
      `Section`, `TaskState` (taskStore); `TaskSelectionState`
      (taskSelectionStore); `UseTaskDragOptions`, `ResolvedMove` (useTaskDrag);
      `UseSectionDragOptions` (useSectionDrag); `IndentTracker` (dragIndent);
      `TreeNode<T>`, `IndentResult<T>` (taskTree); `TaskLike<T>`, `FlatRow<T>`,
      `Projection` (taskProjection)
- [ ] Create `app/src/types/stores.ts`: `OptimisticOp<T>`, `RunOptimisticOptions<T,R>`
      (stores/optimistic)
- [ ] Create `app/src/types/hooks.ts`: `VisibilityPreferenceKey`,
      `VisibilityPreferenceUpdate` (useTaskVisibilityPreferences)
- [ ] Update importers of all of the above (pages: Daily, Inbox, Upcoming,
      Collections; components: TaskList, TaskItem, TaskDetail,
      TaskBlockPreview, TaskVisibilityControls; hooks: useTaskDrag,
      useSectionDrag; utils consumers of tree/projection; stores) — tests
      included
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract task domain types to src/types/`

## Milestone 3 — collection/nav domain (`app/src/types/collections.ts`)

- [ ] Create `app/src/types/collections.ts`: `FlatCollection`,
      `CollectionRowProps` (CollectionTreeNav); `CollectionTreeNode`,
      `CollectionState` (collectionStore); `CollectionMenuHandlers`
      (collectionMenuItems); `CollectionRowProps` (CollectionsIndexPage —
      merge with the CollectionTreeNav one if identical, else keep suffixed);
      `SidebarProps`, `NavItem` (Sidebar); `SidebarNavItemProps`;
      `SectionHeaderProps`; `SectionDeleteModalProps`
- [ ] Update importers (Sidebar, SidebarNavItem, SectionHeader,
      SectionDeleteModal, CollectionTreeNav, collectionStore, CollectionsPage,
      CollectionsIndexPage, DailyPage, CollectionMenu, tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract collection and nav types`

## Milestone 4 — habit domain (`app/src/types/habits.ts`)

- [ ] Create `app/src/types/habits.ts`: `HabitBlockPreviewProps`;
      `HabitCalendarProps`, `HabitCalendarGridProps`; `HabitDotProps`;
      `HabitMonthGridProps`; `HabitTimelineProps`, `HabitEditTarget`,
      `TimelineRow`, `TimelineSection`, `DayCell`, `TimelineBlockPreviewProps`;
      `HabitsView` (HabitsPage); `UseHabitDragOptions`; `HabitRow`,
      `HabitProjection`, `HabitDepth` (habitProjection); `DayState`,
      `HabitNode`, `HabitGroupSection`, `HabitSections` (habitTree)
- [ ] Update importers (HabitsPage, habits/* components, useHabitDrag,
      habitProjection/habitTree consumers, tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract habit domain types`

## Milestone 5 — UI primitives + widgets (`app/src/types/ui.ts`, `types/widgets.ts`)

- [ ] Create `app/src/types/ui.ts` (all `components/ui/*` props):
      `ButtonVariant`, `ButtonSize`, `ButtonProps`; `CheckboxProps`;
      `ChipProps`, `CollectionChipProps`; `ColorPickerPopoverProps`,
      `PickerState`, `ChannelKey`; `ContextMenuItem`, `ContextMenuProps`,
      `ContextMenuRootProps`, `MenuPanelProps`, `SubMenuWrapperProps`;
      `SelectOption`, `CustomSelectProps`; `InlineNameInputProps`; `InputProps`;
      `Priority`, `PriorityDotProps`; `RadioProps`; `SelectProps`; `TaskStatus`,
      `StatusPillProps`; `StripNavigatorProps`; `TaskRowSpecimenData`;
      `ToggleProps`; `ViewMode`, `ViewToolbarProps`
- [ ] Create `app/src/types/widgets.ts`: `ConfirmModalProps`; `TokenType`,
      `Token`, `FilterBarProps`; `QuickAddProps`; `SearchResult`,
      `SearchOverlayProps`; `UpdateToastProps`; `AuthShellProps`;
      `MonthlyCalendarSpecimenProps`; `MonthlyRowsProps`; `MonthTile`,
      `MonthSelectorProps`, `MonthSelectorHandle`
- [ ] Update importers (all of `components/ui/*`, ConfirmModal, FilterBar,
      QuickAdd, SearchOverlay, UpdateToast, AuthShell, monthly/*, their
      callers and tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract UI primitive and widget props types`

## Milestone 6 — hooks/contexts/misc (`types/hooks.ts`, `types/sync.ts`, `types/utils.ts`, `types/i18n.ts`, `drag.ts` additions)

- [ ] `types/hooks.ts` additions: `ShortcutContext`, `SingleBinding`,
      `ChordBinding`, `Binding`, `KeyEvent`, `MatcherState` (shortcuts);
      `Position`, `Placement`, `Align`, `FloatingOptions`, `FloatingResult`
      (useFloatingPosition); `MidnightCallback` (useMidnightTimer);
      `VersionResponse` (useVersionCheck)
- [ ] Create `app/src/types/sync.ts`: `SyncEvent` (hooks/useSync)
- [ ] Create `app/src/types/utils.ts`: `Rgb`, `Hsv`, `Hsl`, `ParsedColor`,
      `ColorFormat` (color); `WeekStart`, `MonthDay`, `ParsedDate` (date);
      `FontOption` (fontLoader); `PhraseSection` (phrases); `BackgroundTheme`
      (theme); `QueuedMutationMethod`, `QueuedMutation` (offlineQueue);
      `MovePayload`, `EchoableEvent` (moveEcho); `Ordered` (order)
- [ ] Create `app/src/types/i18n.ts`: `HelpSection`, `HelpContent`
      (helpContent); `I18nContextValue` (I18nContext). Leave `Locale` in
      `i18n/catalogs.ts` (derived from a runtime const)
- [ ] Add `DragHandlers`, `DragOverlayInfo`, `PlannerDragContextValue` to
      `types/drag.ts` (from contexts/usePlannerDrag)
- [ ] Update importers and tests; confirm `TaskOrderScope` is now referenced
      from `types/drag.ts` only
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract hook, util, sync and drag-context types`

## Milestone 7 — api type files (`api/src/types/`)

- [ ] `api/src/types/recurrence.ts`: `RecurrenceRule`, `DueDate` (superset
      shape: `date: string | Date`); update `recurrenceEngine.ts` and
      `dateParser.ts` to import it; verify both call sites compile
- [ ] `api/src/types/parsers.ts`: unified `PeggyParser`, `ParserOptions`;
      update both parsers
- [ ] `api/src/types/tasks.ts`: `TaskRow`, `SubtreeRow`, `MovedTaskSummary`,
      `CreateTaskInput`, `UpdateTaskInput`, `MoveTaskInput`, `TaskOrderScope`
      (taskService); update `taskService.ts` and importers (routes, tests)
- [ ] `api/src/types/habits.ts`: `HabitRow`, `HabitGroupRow`, `Habit`,
      `HabitGroup`, `CreateHabitInput`, `UpdateHabitInput`, `CompletionResult`,
      `UpdateHabitGroupInput`, `MoveHabitInput`, `MoveHabitResult`,
      `MoveHabitGroupInput`, `MoveHabitGroupResult`; update `habitService.ts`
      and importers
- [ ] `api/src/types/collections.ts`: `CollectionRow`, `CreateCollectionInput`,
      `UpdateCollectionInput`; `SectionRow`, `CreateSectionInput`,
      `UpdateSectionInput`; `InvitationRow`, `CollaboratorRow`; `LabelRow`,
      `CreateLabelInput`, `UpdateLabelInput`; update the four services
- [ ] `api/src/types/views.ts`: `ViewTaskRow`, `ViewPreferencesRow`,
      `TodayView`, `UpcomingView`, `MonthView`; update `viewService.ts`
- [ ] `api/src/types/filters.ts`: `FilterExpr`, `FilterParseError`,
      `FilterRow`, `CreateFilterInput`, `UpdateFilterInput`, `EvalTask`,
      `EvalContext`; update filterParser/filterService/filterEvaluator
- [ ] `api/src/types/sync.ts`: `SocketData`, `SyncEntityType`,
      `SyncEventType`, `SyncEvent`; update `syncService.ts` and Socket.IO
      consumers
- [ ] `api/src/types/auth.ts`: `UserRole`, `UserData`, `RegisterInput`,
      `SessionContext`, `SessionRow`, `SessionCookieOptions`; update
      authService/sessionService
- [ ] `api/src/types/admin.ts`: `AdminUser`, `AdminUserRow`, `ListUsersResult`,
      `AdminCounts`, `AdminHealth`, `AdminAuthStats`; update the two admin
      services
- [ ] `api/src/types/activity.ts`: `ActivityRow`, `ListActivityOptions`,
      `SearchableEntity`, `SearchResults`, `CommentRow`, `ReminderRow`;
      update activity/search/comment/reminder services
- [ ] `api/src/types/misc.ts`: `PreferencesRow`, `UpdatePreferencesInput`,
      `RateLimitResult`, `MemEntry`, `SecurityEventType`, `SecurityEvent`,
      `ValidationError`, `TaskInput`, `RequestContext`; update
      preferences/rateLimit/securityLogger/validate/taskValidation/requestContext
- [ ] Verify after each sub-batch: `docker compose exec api npm run build &&
      npm run lint`; full `npm test` at the end of the milestone
- [ ] Commit (3–4 commits): `refactor(api): extract service types to
      src/types/` (+ domain suffixes)

## Milestone 8 — sweep + full verification

- [ ] Grep audit: no `interface`/`type` declarations remain in
      `app/src/**/*.tsx` and `api/src/**/*.ts` outside `types/` and the
      exceptions list (run the same inventory grep as the plan phase)
- [ ] `docker compose exec api npm test` — full suite
- [ ] `docker compose exec app npm test` — full suite
- [ ] `docker compose exec api npm run build` / `docker compose exec app npm
      run build` — clean, strict mode, no `any` introduced
- [ ] Byte-diff audit: `git diff` of one mid-file (e.g. DailyPage) shows only
      removed type blocks + rewritten imports, no logic drift
- [ ] Commit: `refactor: sweep remaining type declarations into types/`

## Rename table (record every collision rename here as you do it)

| Moved type | New name | Reason |
|---|---|---|
| `Comment` (TaskDetail) | `TaskComment` | collides with DOM `Comment` / generic name in central file |
| `Task` (taskStore, private) | `StoreTask` | collides with `Task` (TaskItem) |
| `TaskRow` (viewService) | `ViewTaskRow` | collides with taskService's `TaskRow` |
| `PreferencesRow` (viewService) | `ViewPreferencesRow` | collides with preferencesService's `PreferencesRow` |

## Verification (whole spec)

- [ ] Both packages: `npm run build`, `npm run lint`, `npm test` green
- [ ] No re-export shims left behind (`export type { X } from` pointing at
      old locations)
- [ ] No behavioural diffs: `git diff --stat` distribution matches the
      milestone plan; no `.ts` file with a net change beyond type removal and
      import rewrites
