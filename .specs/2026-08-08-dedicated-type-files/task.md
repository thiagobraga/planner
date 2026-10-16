# Dedicated interface files — Tasks

Source plan: `plan.md`. Refresh 2026-10-16 against current codebase.

Pure refactor: move every interface/type out of implementation files into
dedicated per-domain type files. No behaviour change, no re-export shims.
Tests keep local mocks. `.d.ts`, `test/setup.ts`, `i18n/types.ts` stay
(see plan Exceptions).

Branch state: `feat/dedicated-type-files` reset to `main` at `f7ed232`.
Prior M1 work on the stale branch was dropped (client.ts has since grown
board types and MonthlyRows was deleted). All milestones below are `[ ]`.

Naming rule: rename narrower shape with domain prefix (`ViewTaskRow`,
`TaskComment`, `StoreTask`) - never merge different shapes.

## Milestone 1 — app API contracts (`app/src/types/api.ts`)

- [ ] Create `app/src/types/api.ts` with all 31 contract types from
      `app/src/api/client.ts`: `ValidationDetail`, `UserRole`, `AuthUser`,
      `ApiTask`, `LabelSummary`, `ApiStatus`, `BoardViewModes`,
      `Preferences`, `TaskMoveInput`, `MovedTaskSummary`,
      `TaskMoveResponse`, `ReorganizeMove`, `ApiCollection`,
      `CollectionView`, `BoardOrder`, `ApiSection`, `ApiHabit`,
      `ApiHabitGroup`, `HabitsResponse`, `HabitMoveInput`,
      `HabitMoveResponse`, `HabitGroupMoveInput`, `HabitGroupMoveResponse`,
      `AdminUser`, `AdminUserList`, `AdminCounts`, `AdminHealth`,
      `AdminAuthStats`. Import `BoardGroupBy`, `TaskOrderScope` from
      `types/drag.ts`; import `BoardViewMode` from `types/board.ts`
- [ ] Strip all type declarations from `api/client.ts`; keep functions only
- [ ] Rewrite every `import type { X } from '../api/client'` to
      `../types/api` (grep `api/client` in `app/src`, incl. tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): move API contract types to src/types/api.ts`

## Milestone 2 — task domain (extend `app/src/types/task.ts`, new `types/stores.ts`)

- [ ] Extend `app/src/types/task.ts` (keep `RecurrenceRule`,
      `ParsedDateInput`, `TaskSchedule`): add `Task`, `TaskItemProps`
      (TaskItem); `TaskListCallbacks`, `TaskListProps`; `TaskComment`
      (renamed from TaskDetail `Comment`), `TaskDetailProps`;
      `TaskBlockPreviewProps`; `TaskVisibilityControlsProps`;
      `StoreTask` (taskStore private `Task`), `StoreSection`, `TaskState`;
      `TaskSelectionState`; `UseTaskDragOptions`, `ResolvedMove`
      (useTaskDrag); `UseSectionDragOptions`; `IndentTracker`
      (dragIndent); `TreeNode`, `IndentResult` (taskTree);
      `TaskLike`, `FlatRow`, `Projection` (taskProjection);
      `ApiScheduleFields` (taskTime)
- [ ] Create `app/src/types/stores.ts`: `OptimisticOp`, `RunOptimisticOptions`
- [ ] Create `app/src/types/hooks.ts` (part): `VisibilityPreferenceKey`,
      `VisibilityPreferenceUpdate`
- [ ] Update importers (Daily, Inbox, Collections, TaskList, TaskItem,
      TaskDetail, drag hooks, tree/projection utils, stores, tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract task domain types to src/types/`

## Milestone 3 — collection/nav (`app/src/types/collections.ts`)

- [ ] Create `app/src/types/collections.ts`: `FlatCollection`,
      `CollectionRowProps` (CollectionTreeNav); `CollectionTreeNode`,
      `CollectionState`; `CollectionMenuHandlers`;
      `CollectionRowProps` (CollectionsIndexPage - merge if identical);
      `SidebarProps`, `NavItem`, `SidebarNavItemProps`;
      `SectionHeaderProps`; `SectionDeleteModalProps`
- [ ] Update importers (Sidebar, CollectionTreeNav, collectionStore,
      CollectionsPage/Index, DailyPage, tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract collection and nav types`

## Milestone 4 — habits (`app/src/types/habits.ts`)

- [ ] Create `app/src/types/habits.ts`: `HabitBlockPreviewProps`;
      `HabitCalendarProps`, `HabitCalendarGridProps`; `HabitDotProps`;
      `HabitMonthGridProps`; `HabitTimelineProps`, `HabitEditTarget`,
      `TimelineRow`, `TimelineSection`, `DayCell`,
      `TimelineBlockPreviewProps`; `HabitsView`;
      `HabitRow`, `HabitProjection`, `HabitDepth` (habitProjection);
      `DayState`, `HabitNode`, `HabitGroupSection`, `HabitSections`
      (habitTree)
- [ ] Update importers (HabitsPage, habits/*, useHabitDrag, projection/tree
      consumers, tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract habit domain types`

## Milestone 5 — UI + widgets (`app/src/types/ui.ts`, `types/widgets.ts`)

- [ ] Create `app/src/types/ui.ts`: `ButtonVariant/Size/Props`,
      `ButtonGroupProps`; `CheckboxProps`; `ChipProps`,
      `CollectionChipProps`; `ColorPickerPopoverProps`, `PickerState`,
      `ChannelKey`; `ContextMenu*` (5); `SelectOption`,
      `CustomSelectProps`; `InlineNameInputProps`; `InputProps`;
      `Priority`, `PriorityDotProps`; `RadioProps`; `SelectProps`;
      `TaskStatus`, `StatusPillProps`; `StripNavigatorProps`;
      `TaskRowSpecimenData`; `ToggleProps`; `ToolbarProps`;
      `ViewSwitcherProps`; `ViewToolbarProps` (use `BoardViewMode`);
      `DateScreenProps`, `RepeatPreset/Unit/Props`, `TimeScreenProps`,
      `TaskDatePickerPanelProps`
- [ ] Create `app/src/types/widgets.ts`: `ConfirmModalProps`; `TokenType`,
      `Token`, `FilterBarProps`; `QuickAddProps`; `SearchResult`,
      `SearchOverlayProps`; `UpdateToastProps`; `AuthShellProps`;
      `MonthlyCalendarSpecimenProps`; `MonthlyViewProps`; `MonthTile`,
      `MonthSelectorProps`, `MonthSelectorHandle`; `PageHeaderProps`;
      `BottomBarProps`
- [ ] Update importers (all `components/ui/*`, overlays, monthly/*, callers,
      tests)
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract UI and widget prop types`

## Milestone 6 — hooks/contexts/misc

- [ ] `types/hooks.ts` additions: `ShortcutContext`, `SingleBinding`,
      `ChordBinding`, `Binding`, `KeyEvent`, `MatcherState`;
      `Position`, `Placement`, `Align`, `FloatingOptions`,
      `FloatingResult`; `MidnightCallback`; `VersionResponse`;
      `UseBoardDragOptions`, `ResolvedBoardMove`, `BoardSnapshot`;
      `BoardColumnDeleteOption`, `DeleteDraft`; `ReorganizeState`,
      `ReorganizePreview`, `UseReorganizeReturn`
- [ ] Create `app/src/types/sync.ts`: `SyncEvent` (useSync)
- [ ] Create `app/src/types/utils.ts`: `Rgb`, `Hsv`, `Hsl`, `ParsedColor`,
      `ColorFormat`; `WeekStart`, `WeekDay`, `MonthDay`, `ParsedDate`;
      `FontOption`; `PhraseSection`; `QueuedMutationMethod`,
      `QueuedMutation`; `MovePayload`, `EchoableEvent`; `Ordered`;
      `DayColumnId`, `DayColumn`; `DateQuickOptionKey/Option`;
      `BoardColumnId`, `BoardColumn`, `StatusListTask/Group`;
      `AgentTranslate`; `RecurrenceLocale`
- [ ] Create `app/src/types/i18n.ts`: `HelpSection`, `HelpContent`;
      `I18nContextValue`. Leave `Locale` in `catalogs.ts`
- [ ] Add to `types/drag.ts`: `DragHandlers`, `DragOverlayInfo`,
      `PlannerDragContextValue`
- [ ] Update importers and tests; confirm `TaskOrderScope`/`BoardGroupBy`
      referenced from `drag.ts` only
- [ ] Verify: `docker compose exec app npm run build && npm run lint`
- [ ] Commit: `refactor(app): extract hook, util, sync and drag-context types`

## Milestone 7 — api types

- [ ] `api/src/types/recurrence.ts`: already done - verify only
- [ ] `api/src/types/parsers.ts` (new): unified `PeggyParser`,
      `ParserOptions`; update both parsers
- [ ] Extend `api/src/types/task.ts`: add `TaskRow`, `SubtreeRow`,
      `MovedTaskSummary`, `CreateTaskInput`, `UpdateTaskInput`,
      `MoveTaskInput`, `TaskOrderScope`, `ReorganizeMove`
- [ ] Create `api/src/types/habits.ts`: `HabitRow`, `HabitGroupRow`,
      `Habit`, `HabitGroup`, `HabitEntityType`, `CreateHabitInput`,
      `UpdateHabitInput`, `CompletionResult`, `UpdateHabitGroupInput`,
      `MoveHabitInput/Result`, `MoveHabitGroupInput/Result`
- [ ] Create `api/src/types/collections.ts`: `CollectionRow`,
      `Create/UpdateCollectionInput`; `SectionRow`,
      `Create/UpdateSectionInput`; `InvitationRow`, `CollaboratorRow`;
      `LabelRow`, `Label`, `Create/UpdateLabelInput`
- [ ] Extend `api/src/types/daily.ts`: add `ViewTaskRow`,
      `ViewPreferencesRow`, `ViewStatusRow`, `BoardOrderRow`
- [ ] Create `api/src/types/filters.ts`: `FilterExpr`, `FilterParseError`,
      `FilterRow`, `Create/UpdateFilterInput`, `EvalTask`, `EvalContext`
- [ ] Create `api/src/types/sync.ts`: `SocketData`, `SyncEntityType`,
      `SyncEventType`, `SyncEvent`
- [ ] Create `api/src/types/auth.ts`: `UserRole`, `UserData`,
      `RegisterInput`; `SessionContext`, `SessionRow`,
      `SessionCookieOptions`
- [ ] Create `api/src/types/admin.ts`: `AdminUser`, `AdminUserRow`,
      `ListUsersResult`; `AdminCounts`, `AdminHealth`, `AdminAuthStats`
- [ ] Extend `api/src/types/activity.ts`: add `ActivityRow`,
      `SearchableEntity`, `SearchResults`, `CommentRow`, `ReminderRow`
- [ ] Extend `api/src/types/apiToken.ts`: add `ApiTokenRow`
- [ ] Create `api/src/types/misc.ts`: `PreferencesRow` (preferencesService),
      `BoardGroupBy`, `BoardViewMode`, `BoardViewModes`,
      `UpdatePreferencesInput`; `RateLimitResult`, `MemEntry`;
      `SecurityEventType`, `SecurityEvent`; `ValidationError`;
      `TaskInput`; `RequestContext`; `SyncCompletionParams`,
      `CompletionSyncResult`; `StatusRow`, `Status`, `DefaultStatusName`,
      `Create/UpdateStatusInput`, `DeleteStatusOptions`
- [ ] Verify after each sub-batch: `docker compose exec api npm run build &&
      npm run lint`; full `npm test` at end
- [ ] Commits (3-4): `refactor(api): extract service types to src/types/`

## Milestone 8 — sweep + verification

- [ ] Grep audit: no `interface`/`type` outside `types/`, tests, `.d.ts`,
      exceptions
- [ ] `docker compose exec api npm test` - full suite
- [ ] `docker compose exec app npm test` - full suite
- [ ] `docker compose exec api npm run build` / `docker compose exec app npm
      run build` - clean strict mode
- [ ] Commit: `refactor: sweep remaining type declarations into types/`

## Rename table

| Moved type | New name | Reason |
|---|---|---|
| `Comment` (TaskDetail) | `TaskComment` | collides with DOM `Comment` |
| `Task` (taskStore, private) | `StoreTask` | collides with `Task` (TaskItem) |
| `Section` (taskStore, private) | `StoreSection` | collides with `useReorganize` `Section` |
| `TaskRow` (viewService) | `ViewTaskRow` | collides with taskService `TaskRow` |
| `PreferencesRow` (viewService) | `ViewPreferencesRow` | collides with preferencesService |
| `StatusRow` (viewService) | `ViewStatusRow` | collides with statusService |

## Verification (whole spec)

- [ ] Both packages: `build`, `lint`, `test` green
- [ ] No re-export shims
- [ ] No behavioural diffs: `git diff --stat` shows only type removal + import rewrites
