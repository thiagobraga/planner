# Dedicated type files — Plan

## Context

Types still live inside implementation files across the codebase: component
props in `.tsx` files, service row/input types in `api/src/services/*.ts`,
hook options in hooks, Zustand state in stores, REST contracts in
`app/src/api/client.ts`.

Goal is unchanged from the original 2026-08-08 spec: move every
interface/type in non-test source files into dedicated per-domain files
under `app/src/types/` and `api/src/types/`, so implementation files
contain only implementation. Pure refactor, no behavior change, no
re-export shims.

This is a refresh of that spec against the current codebase state
(2026-10-16). The original inventory (73 app files, 27 api files) is
stale. New features since August added dedicated type files on their own
(see Current state), which this plan reuses instead of replacing.

## Current state

Already dedicated (do not recreate, extend where noted):

- `app/src/types/`: `activity.ts`, `adminCompare.ts`, `apiToken.ts`,
  `board.ts` (`BoardViewMode`), `daily.ts` (`DailySlug`, `DailyRange`,
  `ApiDailyView`, `DaySection`, `DailyListProps`), `dailyBoard.ts`,
  `drag.ts` (21 drag/drop types + guards), `editableText.ts`, `oauth.ts`,
  `task.ts` (`RecurrenceRule`, `ParsedDateInput`, `TaskSchedule`),
  `taskAddInput.ts`, `theme.ts`
- `api/src/types/`: `activity.ts` (5), `apiToken.ts` (6), `daily.ts` (3),
  `mcp.ts` (4), `oauth.ts` (6), `recurrence.ts` (`RecurrenceRule`,
  `DueDate` - done), `task.ts` (`TaskTimeRow`, `TaskTimeFields`)

Still inline (Oct 2026 audit):

- **app**: 227 declarations in 106 files. Biggest: `api/client.ts` (31
  contract types), `hooks/shortcuts.ts` (6), `components/habits/HabitTimeline.tsx`
  (6), `utils/color.ts` (5), `utils/boardColumns.ts` (5),
  `hooks/useFloatingPosition.ts` (5), `components/ui/ContextMenu.tsx` (5).
- **api**: 95 declarations in 30 files. Biggest: `services/habitService.ts`
  (14), `services/taskService.ts` (9), `services/statusService.ts` (6),
  `services/preferencesService.ts` (5), `services/viewService.ts` (4),
  `services/syncService.ts` (4), `services/labelService.ts` (4).

### Scope decisions (unchanged)

1. **Layout** - central per-domain files under `app/src/types/` and
   `api/src/types/`. Reuse existing files; create only missing domains.
2. **Scope** - everything: exported and private interfaces/types in
   non-test files, including props, row types, hook options, store state,
   page-local shapes.
3. **Tests** - mocks in `__tests__` / `*.test.ts` stay local.
4. **No re-export shims** - delete cleanly; importers get `import type`
   rewrites in the same milestone.

## Deduplication

Only byte-identical shapes merge. Different shapes move side by side
with distinct names.

| Type | Homes | Action |
|---|---|---|
| `TaskOrderScope` | `types/drag.ts` + `api/client.ts:420` (identical) | Keep `drag.ts`, import it |
| `BoardGroupBy` | `types/drag.ts` + `api/client.ts:302` (identical) | Keep `drag.ts`, import it |
| `BoardViewMode` | `types/board.ts` + `api/client.ts:303` (re-export) | Keep `board.ts`, drop re-export |
| `ViewMode` | `components/ui/ViewToolbar.tsx:10` (dup of `BoardViewMode`) | Unify to `BoardViewMode` |
| `RecurrenceRule`, `DueDate` | `api/src/types/recurrence.ts` (done) | `engines/recurrenceEngine.ts:5` keeps its widened `DueDate` extension; `parsers/dateParser.ts` already re-exports |

Do not merge:

- `Task` (`components/TaskItem.tsx`) vs `Task` (`stores/taskStore.ts`,
  private, has `recurrenceRule`, no `indent`/`labels`) vs `ApiTask`
  (`api/client.ts`) - keep all three, rename store one to `StoreTask`.
- `SyncEvent` (api `syncService.ts` vs app `useSync.ts`) - stays
  per-package, no shared package exists.
- `*Row` shapes (`TaskRow` in `taskService.ts` vs `viewService.ts`,
  `PreferencesRow` vs `ViewPreferencesRow`, `StatusRow` in two services)
  - prefix the narrower one (`ViewTaskRow`, `ViewPreferencesRow`).
- `Section` (`taskStore.ts` vs `useReorganize.ts`) - keep store one as
  `StoreSection` or scoped import; document in task.md rename table.
- `Comment` (`TaskDetail.tsx`) vs DOM `Comment` - rename to `TaskComment`.

## Exceptions (stay where they are)

- `.d.ts` files (`express.d.ts`, `eyedropper.d.ts`)
- `app/src/test/setup.ts` ambient declarations
- `app/src/i18n/types.ts` (already dedicated); `Locale` derived from
  `SUPPORTED_LOCALES` in `i18n/catalogs.ts` stays (runtime-derived)
- Import aliases: `type Client = PoolClient` (taskService, habitService),
  `type ReactNode = React.ReactNode` (Sidebar) - import conveniences
- `PeggyParser` copies fold into `api/src/types/parsers.ts` (one new file)

## Target layout

### `app/src/types/` (extend existing where marked [E], else new [N])

| File | Contents |
|---|---|
| `api.ts` [N] | All 31 contracts from `api/client.ts`: `ValidationDetail`, `UserRole`, `AuthUser`, `ApiTask`, `LabelSummary`, `ApiStatus`, `BoardViewModes`, `Preferences`, `TaskMoveInput`, `MovedTaskSummary`, `TaskMoveResponse`, `ReorganizeMove`, `ApiCollection`, `CollectionView`, `BoardOrder`, `ApiSection`, `ApiHabit`, `ApiHabitGroup`, `HabitsResponse`, `HabitMoveInput/Response`, `HabitGroupMoveInput/Response`, `AdminUser`, `AdminUserList`, `AdminCounts`, `AdminHealth`, `AdminAuthStats`. (`BoardGroupBy`, `TaskOrderScope` import from `drag.ts`; `BoardViewMode` imports from `board.ts`). `client.ts` keeps functions only |
| `task.ts` [E] | `Task`, `TaskItemProps` (TaskItem); `TaskListCallbacks`, `TaskListProps`; `TaskComment`, `TaskDetailProps`; `TaskBlockPreviewProps`; `TaskVisibilityControlsProps`; `StoreTask`, `StoreSection`, `TaskState` (taskStore); `TaskSelectionState`; `UseTaskDragOptions`, `ResolvedMove`; `UseSectionDragOptions`; `IndentTracker`; `TreeNode`, `IndentResult`; `TaskLike`, `FlatRow`, `Projection`; `ApiScheduleFields` (taskTime) |
| `collections.ts` [N] | `FlatCollection`, `CollectionRowProps` (CollectionTreeNav); `CollectionTreeNode`, `CollectionState`; `CollectionMenuHandlers`; `CollectionRowProps` (CollectionsIndexPage); `SidebarProps`, `NavItem`, `SidebarNavItemProps`; `SectionHeaderProps`; `SectionDeleteModalProps` |
| `habits.ts` [N] | `HabitBlockPreviewProps`; `HabitCalendarProps`, `HabitCalendarGridProps`; `HabitDotProps`; `HabitMonthGridProps`; `HabitTimelineProps`, `HabitEditTarget`, `TimelineRow`, `TimelineSection`, `DayCell`, `TimelineBlockPreviewProps`; `HabitsView`; `UseHabitDragOptions`; `HabitRow`, `HabitProjection`, `HabitDepth`; `DayState`, `HabitNode`, `HabitGroupSection`, `HabitSections` |
| `ui.ts` [N] | All `components/ui/*` props: `ButtonVariant/Size/Props`, `ButtonGroupProps`, `CheckboxProps`, `ChipProps`, `CollectionChipProps`, `ColorPickerPopoverProps`, `PickerState`, `ChannelKey`, `ContextMenu*` (5), `SelectOption`, `CustomSelectProps`, `InlineNameInputProps`, `InputProps`, `Priority`, `PriorityDotProps`, `RadioProps`, `SelectProps`, `TaskStatus`, `StatusPillProps`, `StripNavigatorProps`, `TaskRowSpecimenData`, `ToggleProps`, `ToolbarProps`, `ViewSwitcherProps`, `ViewToolbarProps` (uses `BoardViewMode`), `DateScreenProps`, `RepeatPreset/Unit/Props`, `TimeScreenProps`, `TaskDatePickerPanelProps` |
| `widgets.ts` [N] | `ConfirmModalProps`; `TokenType`, `Token`, `FilterBarProps`; `QuickAddProps`; `SearchResult`, `SearchOverlayProps`; `UpdateToastProps`; `AuthShellProps`; `MonthlyCalendarSpecimenProps`; `MonthTile`, `MonthSelectorProps`, `MonthSelectorHandle`; `MonthlyViewProps`; `PageHeaderProps`; `BottomBarProps` |
| `hooks.ts` [N] | `ShortcutContext`, `SingleBinding`, `ChordBinding`, `Binding`, `KeyEvent`, `MatcherState`; `Position`, `Placement`, `Align`, `FloatingOptions`, `FloatingResult`; `MidnightCallback`; `VersionResponse`; `VisibilityPreferenceKey/Update`; `UseBoardDragOptions`, `ResolvedBoardMove`, `BoardSnapshot`; `BoardColumnDeleteOption`, `DeleteDraft`; `ReorganizeState`, `ReorganizePreview`, `UseReorganizeReturn`; `UseHabitDragOptions` if not in `habits.ts` |
| `stores.ts` [N] | `OptimisticOp`, `RunOptimisticOptions` |
| `sync.ts` [N] | `SyncEvent` (useSync) |
| `utils.ts` [N] | `Rgb`, `Hsv`, `Hsl`, `ParsedColor`, `ColorFormat`; `WeekStart`, `WeekDay`, `MonthDay`, `ParsedDate`; `FontOption`; `PhraseSection`; `QueuedMutationMethod`, `QueuedMutation`; `MovePayload`, `EchoableEvent`; `Ordered`; `DayColumnId`, `DayColumn`; `DateQuickOptionKey/Option`; `BoardColumnId`, `BoardColumn`, `StatusListTask/Group`; `Translate` (agentNotice); `RecurrenceLocale` |
| `i18n.ts` [N] | `HelpSection`, `HelpContent`; `I18nContextValue` |
| `drag.ts` [E] | Add `DragHandlers`, `DragOverlayInfo`, `PlannerDragContextValue` |
| `daily.ts` [E] | Already has `DaySection`; add `DailyPage` extras if any remain |

### `api/src/types/` (extend existing [E], else new [N])

| File | Contents |
|---|---|
| `recurrence.ts` [E, done] | Already `RecurrenceRule`, `DueDate`; no change |
| `task.ts` [E] | Add `TaskRow`, `SubtreeRow`, `MovedTaskSummary`, `CreateTaskInput`, `UpdateTaskInput`, `MoveTaskInput`, `TaskOrderScope`, `ReorganizeMove` (taskService). Keep `TaskTimeRow`, `TaskTimeFields` |
| `parsers.ts` [N] | Unified `PeggyParser`, `ParserOptions`; update both parsers |
| `habits.ts` [N] | `HabitRow`, `HabitGroupRow`, `Habit`, `HabitGroup`, `HabitEntityType`, `CreateHabitInput`, `UpdateHabitInput`, `CompletionResult`, `UpdateHabitGroupInput`, `MoveHabitInput/Result`, `MoveHabitGroupInput/Result` |
| `collections.ts` [N] | `CollectionRow`, `Create/UpdateCollectionInput`; `SectionRow`, `Create/UpdateSectionInput`; `InvitationRow`, `CollaboratorRow`; `LabelRow`, `Label`, `Create/UpdateLabelInput` |
| `daily.ts` [E] | Add `ViewTaskRow`, `ViewPreferencesRow`, `ViewStatusRow`, `BoardOrderRow` (viewService). Keep `DailyTask`, `DailyDay`, `DailyView` |
| `filters.ts` [N] | `FilterExpr`, `FilterParseError`, `FilterRow`, `Create/UpdateFilterInput`, `EvalTask`, `EvalContext` |
| `sync.ts` [N] | `SocketData`, `SyncEntityType`, `SyncEventType`, `SyncEvent` |
| `auth.ts` [N] | `UserRole`, `UserData`, `RegisterInput`; `SessionContext`, `SessionRow`, `SessionCookieOptions` |
| `admin.ts` [N] | `AdminUser`, `ListUsersResult`, `AdminUserRow`; `AdminCounts`, `AdminHealth`, `AdminAuthStats` |
| `activity.ts` [E] | Add `ActivityRow`, `SearchableEntity`, `SearchResults`, `CommentRow`, `ReminderRow`. Keep existing 5 |
| `misc.ts` [N] | `PreferencesRow` (preferencesService), `BoardGroupBy`, `BoardViewMode`, `BoardViewModes`, `UpdatePreferencesInput`; `RateLimitResult`, `MemEntry`; `SecurityEventType`, `SecurityEvent`; `ValidationError`; `TaskInput`; `RequestContext`; `SyncCompletionParams`, `CompletionSyncResult`; `StatusRow`, `Status`, `DefaultStatusName`, `Create/UpdateStatusInput`, `DeleteStatusOptions` |
| `apiToken.ts` [E] | Add `ApiTokenRow`. Keep existing 6 |

## Relevant Files

- `app/src/api/client.ts` - 31 contract types, source of `types/api.ts`
- `app/src/components/TaskItem.tsx` - canonical `Task`
- `app/src/stores/taskStore.ts`, `collectionStore.ts`, `optimistic.ts`, `taskSelectionStore.ts` - store state
- `app/src/components/board/*`, `app/src/components/ui/*`, `app/src/components/habits/*`, `app/src/components/monthly/*` - props
- `app/src/hooks/*`, `app/src/contexts/*`, `app/src/utils/*` - hook/util types
- `app/src/types/*` - existing dedicated files to extend
- `api/src/services/*`, `api/src/parsers/*`, `api/src/engines/recurrenceEngine.ts` - service types
- `api/src/types/*` - existing dedicated files to extend
- `.specs/2026-08-08-dedicated-type-files/task.md` - milestone breakdown

## Execution order

1. App API contracts (`types/api.ts`).
2. Task domain (extend `types/task.ts` + new `types/stores.ts`).
3. Collection/nav (`types/collections.ts`).
4. Habits (`types/habits.ts`).
5. UI + widgets (`types/ui.ts`, `types/widgets.ts`).
6. Hooks/contexts/misc (`types/hooks.ts`, `sync.ts`, `utils.ts`, `i18n.ts`, `drag.ts`).
7. API types (extend `task.ts`, `daily.ts`, `activity.ts`, `apiToken.ts`; new `parsers.ts`, `habits.ts`, `collections.ts`, `filters.ts`, `sync.ts`, `auth.ts`, `admin.ts`, `misc.ts`).
8. Sweep + full verification.

Each milestone: implement, `tsc --noEmit` or `npm run build`, `npm run lint`, relevant `npm test`. One Conventional Commit per milestone.

## Verification

1. `docker compose exec api npm run build && npm run lint && npm test`
2. `docker compose exec app npm run build && npm run lint && npm test`
3. Grep audit: no `interface`/`type` outside `types/`, `*.test.*`, `__tests__`, `*.d.ts`, exceptions.
4. Byte-diff of one mid-file (e.g. DailyPage) shows only removed type blocks + import rewrites.

## Risks

- Import churn (~136 files) - build catches missed sites under strict mode.
- Name collisions - prefix narrower shape, never merge.
- Tests import from old locations - update in same milestone.
