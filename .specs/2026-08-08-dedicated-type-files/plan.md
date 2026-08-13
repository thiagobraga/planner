# Dedicated interface files — Plan

## Context

Interfaces and type aliases currently live inside implementation files all over
the codebase: component props inside `.tsx` components, service row/input types
inside `api/src/services/*.ts`, hook options inside hook implementations, store
state inside Zustand stores, REST contracts inside `app/src/api/client.ts`.

Goal: move every interface/type defined in non-test source files into dedicated
**per-domain type files** under `app/src/types/` and `api/src/types/`, so
implementation files contain only implementation.

### Precedent

- `app/src/types/drag.ts` — already a dedicated central drag-type file (created
  for drag metadata/API contracts, commit `db82cc0`); this plan extends the
  pattern to the whole codebase.
- `app/src/i18n/types.ts` — already a dedicated type file; untouched.
- `api/src/types/express.d.ts`, `app/src/types/eyedropper.d.ts` — already type
  files; untouched.

### Scope decisions (agreed)

1. **Layout** — central per-domain files: `app/src/types/` and `api/src/types/`
   (not sibling `*.types.ts` files, not a hybrid).
2. **Scope** — everything: exported *and* private interfaces/types in non-test
   files, including component props, service row types, hook options, store
   state, page-local shapes.
3. **Tests** — mock interfaces defined inside `__tests__`/`*.test.ts` files
   stay local to the tests; no change.
4. **No re-export shims** — delete cleanly (AGENTS.md convention); every
   importer rewrites its `import type` to the new location.

## Inventory

- **app**: 73 non-test files contain interfaces; 92 exported interfaces
  (across 41 files) plus ~50 private interfaces.
- **api**: 27 non-test files contain interfaces; 49 exported plus ~20 private
  row types.
- Biggest consumers: `Task` (defined in `TaskItem.tsx`) is imported by 21+
  files; `ApiTask`/`Preferences`/`ApiCollection` from `api/client.ts` are
  imported by most pages.

## Deduplication (only byte-identical shapes; no other merging in this PR)

| Type | Current homes | Action |
|---|---|---|
| `TaskOrderScope` | `app/src/types/drag.ts:42` + `app/src/api/client.ts:375` (identical) | Keep one definition, import where needed |
| `RecurrenceRule`, `DueDate` | `api/src/engines/recurrenceEngine.ts` + `api/src/parsers/dateParser.ts` (near-identical; dateParser is a narrowed subset) | Single `api/src/types/recurrence.ts`, superset shape; verify call sites compile |

Explicitly **not** merged (different shapes, all move side by side with
distinct names):

- `Task` (`components/TaskItem.tsx`) vs `Task` (`stores/taskStore.ts`, private,
  has `recurrenceRule`, no `indent`/`labels`) vs `ApiTask` (`api/client.ts`)
  — keep all three, rename alongside only to resolve central-file collisions.
- `SyncEvent` (`api/src/services/syncService.ts` vs
  `app/src/hooks/useSync.ts`) — stays per-package; no shared package exists.
  Cross-package consolidation is a follow-up, not part of this refactor.
- per-service `*Row` DB shapes (`TaskRow` in `taskService.ts` and
  `viewService.ts` are different) — renamed with a domain prefix where they
  collide in a central file.

## Exceptions (stay where they are)

- `.d.ts` files (`express.d.ts`, `eyedropper.d.ts`)
- `app/src/test/setup.ts` (test infra ambient declarations)
- `app/src/i18n/` — `types.ts` already dedicated; `catalogs.ts` is a re-export
- Module-scoped import aliases of third-party types, e.g.
  `type Client = PoolClient` (habitService, taskService),
  `type ReactNode = React.ReactNode` (Sidebar), `PeggyParser` — import-time
  conveniences, not domain types (though the `PeggyParser` alias appears in
  both parsers and is folded into the api parsers type file)

## Target layout

### `app/src/types/` (new files unless noted)

| File | Contents (source file) |
|---|---|
| `api.ts` | All REST contract types from `app/src/api/client.ts`: `ValidationDetail`, `UserRole`, `AuthUser`, `ApiTask`, `Preferences`, `TaskMoveInput`, `MovedTaskSummary`, `TaskMoveResponse`, `ApiCollection`, `CollectionView`, `ApiSection`, `ApiHabit`, `ApiHabitGroup`, `HabitsResponse`, `HabitMoveInput/Response`, `HabitGroupMoveInput/Response`, `AdminUser`, `AdminUserList`, `AdminCounts`, `AdminHealth`, `AdminAuthStats`. `client.ts` keeps only functions. |
| `tasks.ts` | `Task`, `TaskItemProps` (TaskItem); `TaskCallbacks`, `TaskListProps` (TaskList); `Comment`→`TaskComment`, `TaskDetailProps` (TaskDetail); `TaskBlockPreviewProps`; `TaskVisibilityControlsProps` + `VisibilityPreferenceKey/Update` (useTaskVisibilityPreferences); `DaySection` (DailyPage); store `Task`, `Section`, `TaskState` (taskStore); `TaskSelectionState`; `UseTaskDragOptions`, `ResolvedMove` (useTaskDrag); `UseSectionDragOptions`; `IndentTracker` (dragIndent); `TreeNode`, `IndentResult<T>` (taskTree); `TaskLike`, `FlatRow<T>`, `Projection` (taskProjection) |
| `collections.ts` | `FlatCollection`, `RowProps`→`CollectionRowProps` (CollectionTreeNav); `CollectionTreeNode`, `CollectionState` (collectionStore); `CollectionMenuHandlers` (collectionMenuItems); `CollectionRowProps` (CollectionsIndexPage); `SidebarProps`, `NavItem` (Sidebar); `SidebarNavItemProps`; `SectionHeaderProps`; `SectionDeleteModalProps` |
| `habits.ts` | `HabitBlockPreviewProps`; `HabitCalendarProps`, `HabitCalendarGridProps`; `HabitDotProps`; `HabitMonthGridProps`; `HabitTimelineProps`, `HabitEditTarget`, `TimelineRow`, `TimelineSection`, `DayCell`, `TimelineBlockPreviewProps`; `HabitsView` (HabitsPage); `UseHabitDragOptions`; `HabitRow`, `HabitProjection`, `HabitDepth` (habitProjection); `DayState`, `HabitNode`, `HabitGroupSection`, `HabitSections` (habitTree) |
| `ui.ts` | `ButtonVariant`, `ButtonSize`, `ButtonProps`; `CheckboxProps`; `ChipProps`, `CollectionChipProps`; `ColorPickerPopoverProps`, `PickerState`, `ChannelKey`; `ContextMenuItem`, `ContextMenuProps`, `ContextMenuRootProps`, `MenuPanelProps`, `SubMenuWrapperProps`; `SelectOption`, `CustomSelectProps`; `InlineNameInputProps`; `InputProps`; `Priority`, `PriorityDotProps`; `RadioProps`; `SelectProps`; `TaskStatus`, `StatusPillProps`; `StripNavigatorProps`; `TaskRowSpecimenData`; `ToggleProps`; `ViewMode`, `ViewToolbarProps` |
| `widgets.ts` | `ConfirmModalProps`; `TokenType`, `Token`, `FilterBarProps` (FilterBar); `QuickAddProps`; `SearchResult`, `SearchOverlayProps`; `UpdateToastProps`; `AuthShellProps`; `MonthlyCalendarSpecimenProps`; `MonthlyRowsProps`; `MonthTile`, `MonthSelectorProps`, `MonthSelectorHandle` (MonthSelector) |
| `hooks.ts` | `ShortcutContext`, `SingleBinding`, `ChordBinding`, `Binding`, `KeyEvent`, `MatcherState` (shortcuts); `Position`, `Placement`, `Align`, `FloatingOptions`, `FloatingResult` (useFloatingPosition); `MidnightCallback` (useMidnightTimer); `VersionResponse` (useVersionCheck) |
| `stores.ts` | `OptimisticOp<T>`, `RunOptimisticOptions<T,R>` (stores/optimistic) |
| `sync.ts` | `SyncEvent` (hooks/useSync) |
| `utils.ts` | `Rgb`, `Hsv`, `Hsl`, `ParsedColor`, `ColorFormat` (color); `WeekStart`, `MonthDay`, `ParsedDate` (date); `FontOption` (fontLoader); `PhraseSection` (phrases); `BackgroundTheme` (theme); `QueuedMutationMethod`, `QueuedMutation` (offlineQueue); `MovePayload`, `EchoableEvent` (moveEcho); `Ordered` (order) |
| `i18n.ts` | `HelpSection`, `HelpContent` (helpContent — it is a pure data module; its types move here); `I18nContextValue` (I18nContext). Note: `Locale = (typeof SUPPORTED_LOCALES)[number]` stays in `i18n/catalogs.ts` — it is derived from a runtime const and cannot live in a type-only module |
| `drag.ts` (existing) | gains `DragHandlers`, `DragOverlayInfo`, `PlannerDragContextValue` (contexts/usePlannerDrag); keeps `TaskOrderScope` (dedup winner when references converge) |

Rough sizes: `api.ts` ~24 types, `tasks.ts` ~20, `habits.ts` ~16, `ui.ts`
~30, `collections.ts` ~9, `widgets.ts` ~10.

### `api/src/types/` (new files)

| File | Contents (source file) |
|---|---|
| `recurrence.ts` | `RecurrenceRule`, `DueDate` (dedup of recurrenceEngine + dateParser) |
| `parsers.ts` | `PeggyParser` alias (unify the two parser-local copies), `ParserOptions` (dateParser) |
| `tasks.ts` | `TaskRow`, `SubtreeRow`, `MovedTaskSummary`, `CreateTaskInput`, `UpdateTaskInput`, `MoveTaskInput`, `TaskOrderScope` (taskService) |
| `habits.ts` | `HabitRow`, `HabitGroupRow`, `Habit`, `HabitGroup`, `CreateHabitInput`, `UpdateHabitInput`, `CompletionResult`, `UpdateHabitGroupInput`, `MoveHabitInput`, `MoveHabitResult`, `MoveHabitGroupInput`, `MoveHabitGroupResult` (habitService) |
| `collections.ts` | `CollectionRow`, `CreateCollectionInput`, `UpdateCollectionInput` (collectionService); `SectionRow`, `CreateSectionInput`, `UpdateSectionInput` (sectionService); `InvitationRow`, `CollaboratorRow` (collaborationService); `LabelRow`, `CreateLabelInput`, `UpdateLabelInput` (labelService) |
| `views.ts` | `TaskRow`→`ViewTaskRow`, `PreferencesRow`→`ViewPreferencesRow`, `TodayView`, `UpcomingView`, `MonthView` (viewService) |
| `filters.ts` | `FilterExpr` (filterParser); `FilterParseError` (filterParser); `FilterRow`, `CreateFilterInput`, `UpdateFilterInput` (filterService); `EvalTask`, `EvalContext` (filterEvaluator) |
| `sync.ts` | `SocketData`, `SyncEntityType`, `SyncEventType`, `SyncEvent` (syncService) |
| `auth.ts` | `UserRole`, `UserData`, `RegisterInput` (authService); `SessionContext`, `SessionRow`, `SessionCookieOptions` (sessionService) |
| `admin.ts` | `AdminUser`, `ListUsersResult`, `AdminUserRow` (adminUserService); `AdminCounts`, `AdminHealth`, `AdminAuthStats` (adminStatsService) |
| `activity.ts` | `ActivityRow`, `ListActivityOptions` (activityService); `SearchableEntity`, `SearchResults` (searchService); `CommentRow` (commentService); `ReminderRow` (reminderService) |
| `misc.ts` | `PreferencesRow`, `UpdatePreferencesInput` (preferencesService); `RateLimitResult`, `MemEntry` (rateLimitService); `SecurityEventType`, `SecurityEvent` (securityLogger); `ValidationError` (validate); `TaskInput` (taskValidation); `RequestContext` (requestContext) |

Approximate naming rule in shared files: when two source files exported the
same name with different shapes, rename the narrower/local one with a domain
prefix (e.g. `ViewTaskRow`) so no behavioural merge happens.

## Execution order

Each milestone: implement → `npm run build` (or `tsc --noEmit`) → `npm run
lint` → relevant `npm test`. Conventional commits, one commit per milestone
(finely sub-committed per domain file as diffs grow).

1. **App API contracts** — create `app/src/types/api.ts` from
   `api/client.ts`; rewrite every `import { type ApiX } from '../api/client'`
   to `types/api` (~40 sites); `client.ts` keeps functions only.
2. **Task domain** — `types/tasks.ts` + `types/stores.ts` + all task/optimistic
   consumers (Daily, Inbox, Upcoming, Collections, TaskList, TaskItem,
   TaskDetail, drag hooks, taskTree/taskProjection/utils).
3. **Collection/nav domain** — `types/collections.ts`.
4. **Habits domain** — `types/habits.ts` + HabitsPage/Timeline/Calendar +
   habit drag/projection/tree.
5. **UI + widgets** — `types/ui.ts`, `types/widgets.ts` (components/ui/* +
   overlays/modals/monthly).
6. **Hooks/contexts/misc** — `types/hooks.ts`, `types/sync.ts`,
   `types/utils.ts`, `drag.ts` additions (useDragContext value types),
   `types.ts` no-op.
7. **API type files** — `api/src/types/*` per table above (split into 3–4
   commits: recurrence/parsers; tasks/habits; collections/views/filters;
   sync/auth/admin/activity/misc), updating all service imports.
8. **Tail** — full sweep: grep for any remaining `interface`/`type` in
   implementation files vs. exceptions list; full `npm test` both packages.

## Verification

1. `docker compose exec api npm run build && npm run lint && npm test`
2. `docker compose exec app npm run build && npm run lint && npm test`
3. Grep audit: no `interface`/`type` declarations remain in
   `app/src/**/*.tsx` outside `types/` (except exceptions); printed type-only
   imports (`import type`) everywhere a moved type is consumed
4. Byte-diff audit of one mid-file (DailyPage) before/after to prove it's a
   pure move (no logic drift)

## Risks / mitigations

- **Import path churn** (~150 files touched) — highest risk is missed
  import sites; the build catches them all (no `any` fallbacks keep strict
  mode working).
- **Name collisions in central files** — resolved by domain prefix
  (documented rename table in `task.md`), never by merging different shapes.
- **Test breakage**: tests import `Task`/`ApiTask` from old locations —
  updated in the same milestone as their sources.
- This is a pure refactor: no runtime behavioral change supersedes the status
  table; reviewers diff imports next to a source-move delta (each file's diff
  is delete-on-one-side/addition-on-other; JSDoc moves with its type).