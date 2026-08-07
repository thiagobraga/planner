# Tasks: Allow users to create Sections

## Phase 1: Backend prep
- [x] Update `viewService.getInboxView()` to return inbox collection UUID

## Phase 2: Foundation (types, API client)
- [x] Add `Section` interface (id, name, collectionId, orderValue)
- [x] Add `SectionDropData` to drag types
- [x] Add `'section'` to DropKind and TaskOrderScope
- [x] Add section CRUD functions to `api/client.ts` (fetch, create, update, delete)
- [x] Expose `sectionId` in `TaskUpdateInput`

## Phase 3: Drag-drop wiring
- [x] Add `'section'` drop kind branch in `resolveMove()`
- [x] Update `TaskList` to accept `sectionId` and `collectionId` props
- [x] Update `useTaskDrag` to handle section drops
- [x] Update `applyMoveLocally` to apply sectionId

## Phase 4a: UI Components
- [x] Create `SectionHeader` component with drag handle + inline edit
- [x] Add i18n keys `page.newSection` (pt-BR, en)

## Phase 4b: CollectionsPage integration
- [x] Import section CRUD functions
- [x] Add section state (sections, editingSectionId)
- [x] Add useQuery for sections
- [x] Create buildSectionGroups() helper
- [x] Update render with per-section TaskLists & SectionHeaders
- [x] Add "+ Novo seção" button
- [x] Wire all section CRUD handlers (add, commit, cancel, delete)

## Phase 4c: InboxPage integration (user-prioritized: "permitir adicionar seções no Inbox também")
- [x] Add imports for section CRUD functions
- [x] Add section state (sections, editingSectionId)  
- [x] Add useQuery for sections (using inboxCollectionId)
- [x] Mirror CollectionsPage render + handlers
  - [x] Add buildSectionGroups() helper (copy CollectionsPage.tsx:68, sort-copy bug fixed in both)
  - [x] Update render to use per-section layout with SectionHeaders
  - [x] Add "+ New section" button after sections
  - [x] Wire section CRUD handlers (add, commit-name, cancel, delete)
  - [x] Wire `handleAddSection` using `inboxCollectionId` (not `id` — Inbox has no route param)
  - [x] Fix `fetchInboxTasks` return type — was missing `inboxCollectionId`, InboxPage was reading it via `(data as any)`

## Phase 4d: Critical bug fixes found in review — DONE
- [x] **Fixed new-task-loses-section bug**: added `sectionId?: string` to `apiCreateTask`'s input type (`app/src/api/client.ts:315`) and forwarded it in the POST body
- [x] Pass `currentTask?.sectionId` through in `handleEditCommit`'s `apiCreateTask` call (both pages) so temp-row commits stay in their section
- [x] `handleAddBelow`/`handleAddAbove` copy `sectionId` from the reference task (both pages) so Enter-to-add-sibling keeps new rows in the same section
- [x] Fixed `buildSectionGroups` mutating `sections` state via `sections.sort()` — copy first: `[...sections].sort(...)` (both pages)
- [x] Fixed pre-existing `tsc -b` type error in CollectionsPage (`group.section.id` missing non-null assertion, line 660) — build was failing before this session
- [x] Verified in browser: created a section, added a sibling task via Enter-below, reloaded — task correctly stayed in the section (previously reverted to top-level)

## Phase 4e: UX fixes from live testing (this session)
- [x] Reordered page layout: task list → "Add task…" input → "+ New section" button (was: list → button → input, confusing which row you'd clicked)
- [x] De-emphasized "+ New section": `opacity-35` + `hover:opacity-100`, matching the `.task-add-input::placeholder` weight, plus one `h-6` spacer row above it
- [x] New-section input now renders in place of the "+ New section" button itself (using `HabitNameInput`, matching HabitsPage's "+ Novo grupo" pattern) instead of appearing up in the middle of the section list — temp (unnamed) sections are filtered out of `buildSectionGroups`'s input and rendered at the button's position instead
- [x] Committed sections now render immediately after the top-level "Add task…" form, directly adjacent to the "+ New section" trigger, instead of being separated from it by the global add-task row — matches user's explicit ask ("Sections created should be where 'Nova seção' is"). Both pages split `buildSectionGroups()`'s result into `topLevelGroup` + `sectionGroups`, rendering top-level tasks + its own add-task form first, then all section blocks, then the add-section row

## Phase 8: Test coverage (unit + e2e) — requested by user
- [ ] Unit: `buildSectionGroups()` grouping logic (top-level bucket, per-section bucket, ordering by orderValue) — both pages
- [ ] Unit: `apiCreateTask` forwards `sectionId` in the POST body
- [ ] Unit: `handleAddBelow`/`handleAddAbove`/`handleEditCommit` preserve `sectionId` from the reference/temp task (regression test for the critical bug fixed in Phase 4d)
- [ ] Unit: API `createTask`/`updateTask` services accept and persist `section_id` (likely already covered — verify)
- [ ] e2e/integration: create section → add task via Enter-below → reload → task still in section
- [ ] e2e/integration: task with children (indent/outdent) inside a section — subtree stays grouped correctly
- [ ] e2e/integration: notes (`-` prefix) inside a section render and persist correctly
- [ ] e2e/integration: section rename, section delete (current no-confirm behavior — update once Phase 5 modal lands)
- [ ] e2e/integration: Inbox and Collections both — since logic is duplicated per-page, not shared

## Phase 5: Section reordering & deletion modal
- [ ] Extend `useTaskDrag` to handle section-level drops (section → section reordering), replacing the `onReorder={() => {}}` stub (`CollectionsPage.tsx:661`)
- [ ] Add `apiUpdateSection` orderValue call on section drag-end, matching how task/habit-group reorder call the backend
- [ ] Create `SectionDeleteModal` component with three-button prompt
  - [ ] Option 1: Delete all tasks in section
  - [ ] Option 2: Move tasks to top-level
  - [ ] Option 3: Cancel
- [ ] Wire modal into SectionHeader delete action, replacing the immediate `apiDeleteSection` call in `handleDeleteSection` (`CollectionsPage.tsx:446`)
- [ ] Surface delete errors to the user instead of `.catch(() => {})` swallowing them silently

## Phase 6: Per-section "add task" affordance (parity with HabitsPage's "+ Novo hábito" per group)
- [ ] Add an inline "+ Add task" row at the bottom of each section's `TaskList`, scoped to that section
- [ ] Wire it to `apiCreateTask` with the fixed `sectionId` param from Phase 4d
- [ ] Apply to both CollectionsPage and InboxPage

## Phase 7: Polish & testing
- [ ] Add CSS styling (`.task-section-header` + hover/group-hover states)
- [ ] Manual testing on Collections and Inbox pages
- [ ] Test all CRUD operations
- [ ] Test section reordering
- [ ] Test deletion modal with each option choice
- [ ] Verify cross-tab sync (useSync + publishEvent)
- [ ] Integration test: create → edit → reorder → delete
- [ ] Integration test: add task inside section via Enter-below and via per-section add row — verify `sectionId` persists after page reload
- [ ] Update CLAUDE.md with section feature usage

## Commits made
- `4c3f2a7` - feat: add section support to drag-drop system (phases 1-3)
- `08edeaf` - feat: add SectionHeader component and i18n keys (phase 4a)
- `4e73604` - feat: integrate sections into CollectionsPage (phase 4b)
- `5aff5d7` - fix: add section import and prepare InboxPage for sections (phase 4c partial)

## Current status
Phases 1-4b complete. Phase 4c partially done (state/queries ready, render pending). Phases 4d-7 not started.

**Next step:** Finish InboxPage render + handlers (Phase 4c — user asked for this explicitly), then Phase 4d bug fixes before touching anything else. The new-task-loses-section bug (4d) is likely why the feature reads as "unreliable" in manual testing — fix it before Phase 5/6 polish, since testing delete/reorder against sections that silently lose tasks will produce confusing results.
