# Tasks: Allow users to create Sections

## Phase 1: Backend prep
- [x] Update `viewService.getInboxView()` to return inbox collection UUID
- [x] Embed `sections` directly in `getInboxView()` / `getCollectionView()` responses via `listSections()` — removes the need for a separate `/collections/:id/sections` fetch on initial page load

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

## Phase 4: UI — CollectionsPage + InboxPage (both pages, feature-complete)
- [x] `SectionHeader` component: drag handle, inline rename, "..." options menu, right-click context menu (Rename / Delete)
- [x] Both pages read `sections` from the view response (no separate query)
- [x] `buildSectionGroups()` groups tasks into top-level + per-section buckets, ordered by `orderValue` (copies the array before sorting — no state mutation)
- [x] Layout, top to bottom: top-level tasks → top-level "Add task…" → each section (header + tasks + its own "Add task…" row) → "+ New section"
- [x] New-section click renders an inline `HabitNameInput` **in place of** the "+ New section" button (styled identically to a committed header: uppercase, tracking-widest, 10px semibold) — matches HabitsPage's "+ Novo grupo" pattern exactly
- [x] Each section has its own persistent "+ Add task" row directly beneath it (parity with HabitsPage's "+ Novo hábito"), wired to `apiCreateTask` with that section's `sectionId`
- [x] One `h-6` spacer row before each section header, matching Habits' vertical rhythm
- [x] Section delete asks for confirmation via `SectionDeleteModal`: **Delete section and tasks** / **Move tasks to top-level** / **Cancel** — no more instant, unconfirmed delete
- [x] i18n keys added (`page.deleteSection*`) in both `en` and `pt-BR`

## Phase 5: Critical bug fixes (found and fixed this session)
- [x] **New-task-loses-section bug**: `apiCreateTask` never sent `sectionId`; `handleEditCommit`/`handleAddBelow`/`handleAddAbove` didn't propagate it either. Any task added via Enter-below inside a section, or the per-section add row, silently landed in top-level. Fixed in both pages — verified via reload that a new sibling task stays in its section.
- [x] `buildSectionGroups` was mutating the `sections` state array in place via `.sort()` — now sorts a copy.
- [x] Pre-existing `tsc -b` failure in `CollectionsPage.tsx` (`group.section.id` missing non-null assertion) — build was broken before this session started.
- [x] Stale `tsx watch` on the API container wasn't picking up source changes — required a manual `docker compose restart api`. Not a code bug, but explains why fixes weren't taking effect mid-session.

## Phase 6: Not yet done
- [ ] Section reordering (drag section header to reorder) — `onReorder={() => {}}` is still a stub in `SectionHeader` usage in both pages
- [ ] Cross-tab sync verification for section CRUD (task CRUD already verified via existing `useSync` wiring; sections use the same `publishEvent` path but hasn't been explicitly tested with two tabs)
- [ ] CSS/design polish pass beyond what's been verified visually in this session
- [ ] Update CLAUDE.md with section feature usage
- [ ] Unit tests: `buildSectionGroups()`, `apiCreateTask` sectionId forwarding, sectionId-preservation regression test
- [ ] e2e/integration tests: create → add task → reload persistence, delete modal (both options), section rename, tasks with children inside a section, notes inside a section

## Manual verification performed this session (browser, dev@planner.local)
- Created sections in Inbox: correct position, inline-edit styling, spacing
- Added tasks directly via per-section "Add task" row → persisted correctly after reload
- Regression-tested the critical bug: task added via Enter-below inside a section survived reload inside that section
- Section rename via right-click context menu
- Section delete modal: tested "Move tasks to top-level" end-to-end (task correctly moved, section removed, persisted after reload)
- Confirmed `sections` now arrives embedded in `/views/inbox` response, no separate section fetch in Network tab
- Full API test suite (738 tests) and full app test suite (867 tests) both pass after all changes

## Commits made (prior to this session's work)
- `4c3f2a7` - feat: add section support to drag-drop system (phases 1-3)
- `08edeaf` - feat: add SectionHeader component and i18n keys (phase 4a)
- `4e73604` - feat: integrate sections into CollectionsPage (phase 4b)
- `5aff5d7` - fix: add section import and prepare InboxPage for sections (phase 4c partial)

This session's changes are uncommitted — everything above (bug fixes, InboxPage completion, layout/UX fixes, per-section add-task, delete modal, context menu, embedded sections) is working-tree only.

## Current status
Feature is functionally complete and usable end-to-end on both Inbox and Collections pages: create, rename, delete (with confirmation), add tasks directly into a section, tasks with the fixed sectionId bug verified. Remaining gaps are section reordering and formal test coverage (Phase 6).
