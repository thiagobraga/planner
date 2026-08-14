# Tasks: Allow users to create Sections

## Phase 1: Backend prep
- [x] Update `viewService.getInboxView()` to return inbox collection UUID
- [x] Embed `sections` directly in `getInboxView()` / `getCollectionView()` responses via `listSections()` - removes the need for a separate `/collections/:id/sections` fetch on initial page load

## Phase 2: Foundation (types, API client)
- [x] Add `Section` interface (id, name, collectionId, orderValue)
- [x] Add `SectionDropData` to drag types
- [x] Add `'section'` to DropKind and TaskOrderScope
- [x] Add section CRUD functions to `api/client.ts` (fetch, create, update, delete)
- [x] Expose `sectionId` in `TaskUpdateInput` and `apiCreateTask`'s input type
- [x] `CollectionView` / `fetchInboxTasks` return types include `sections: ApiSection[]`

## Phase 3: Drag-drop wiring
- [x] Add `'section'` drop kind branch in `resolveMove()`
- [x] Update `TaskList` to accept `sectionId` and `collectionId` props
- [x] Update `useTaskDrag` to handle section drops
- [x] Update `applyMoveLocally` to apply sectionId

## Phase 4: UI - CollectionsPage + InboxPage (both pages, feature-complete)
- [x] `SectionHeader` component: drag handle, inline rename, "..." options menu, right-click context menu (Rename / Delete)
- [x] Both pages read `sections` from the view response (no separate query)
- [x] `buildSectionGroups()` groups tasks into top-level + per-section buckets, ordered by `orderValue` (copies the array before sorting - no state mutation)
- [x] Layout, top to bottom: top-level tasks -> top-level "Add task…" -> each section (header + tasks + its own "Add task…" row) -> "+ New section"
- [x] New-section click renders an inline `HabitNameInput` in place of the "+ New section" button (styled identically to a committed header: uppercase, tracking-widest, 10px semibold) - matches HabitsPage's "+ Novo grupo" pattern exactly
- [x] Each section has its own persistent "+ Add task" row directly beneath it (parity with HabitsPage's "+ Novo hábito"), wired to `apiCreateTask` with that section's `sectionId`
- [x] One `h-6` spacer row before each section header, matching Habits' vertical rhythm
- [x] Section delete asks for confirmation via `SectionDeleteModal`: **Delete section and tasks** / **Move tasks to top-level** / **Cancel** - no more instant, unconfirmed delete
- [x] i18n keys added (`page.deleteSection*`) in both `en` and `pt-BR`

## Phase 5: Critical bug fixes
- [x] **New-task-loses-section bug**: `apiCreateTask` never sent `sectionId`; `handleEditCommit`/`handleAddBelow`/`handleAddAbove` didn't propagate it either. Any task added via Enter-below inside a section, or the per-section add row, silently landed in top-level. Fixed in both pages - verified via reload that a new sibling task stays in its section.
- [x] `buildSectionGroups` was mutating the `sections` state array in place via `.sort()` - now sorts a copy.
- [x] Pre-existing `tsc -b` failure in `CollectionsPage.tsx` (`group.section.id` missing non-null assertion) - build was broken before this session started.
- [x] Stale `tsx watch` on the API container wasn't picking up source changes - required a manual `docker compose restart api`. Not a code bug, but explains why fixes weren't taking effect mid-session.

## Phase 6: Completed Tasks
- [x] Section reordering (drag section header to reorder) - `useSectionDrag` implemented and verified via unit tests
- [x] Cross-tab sync verification for section CRUD (task CRUD and section events use existing `publishEvent` and `useSync` path)
- [x] CSS/design polish pass verified visually
- [x] Unit tests: `buildSectionGroups()`, `apiCreateTask` sectionId forwarding, sectionId-preservation regression test (`InboxPage.sections.test.tsx`, `useSectionDrag.test.tsx`, `useTaskDrag.section.test.ts`)
- [x] E2E integration tests: `app/e2e/sectionCreation.spec.ts` (create section -> add task in section -> reload persistence -> rename section -> delete modal with "Move tasks to top-level" -> delete modal with "Delete section and tasks")

## Verification Results
- All unit and integration test suites passing (API: 88 files, 908 tests; App: 111 files, 1003 tests)
- Playwright E2E test suite passing (6 tests including `sectionCreation.spec.ts`)
- Visual screenshots saved:
  - [sections-created.png](file:///p/projects/planner-section-creation/app/dist/screenshots/sections-created.png)
  - [sections-reloaded.png](file:///p/projects/planner-section-creation/app/dist/screenshots/sections-reloaded.png)
  - [sections-deleted.png](file:///p/projects/planner-section-creation/app/dist/screenshots/sections-deleted.png)
