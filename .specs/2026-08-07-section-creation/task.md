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

## Phase 4c: InboxPage integration
- [x] Add imports for section CRUD functions
- [x] Add section state (sections, editingSectionId)  
- [x] Add useQuery for sections (using inboxCollectionId)
- [~] Mirror CollectionsPage render + handlers (in progress)
  - [ ] Add buildSectionGroups() helper
  - [ ] Update render to use per-section layout with SectionHeaders
  - [ ] Add "+ Novo seção" button after sections
  - [ ] Wire section CRUD handlers

## Phase 5: Section reordering & deletion modal
- [ ] Extend `useTaskDrag` to handle section-level drops (section → section reordering)
- [ ] Create `SectionDeleteModal` component with three-button prompt
  - [ ] Option 1: Delete all tasks in section
  - [ ] Option 2: Move tasks to top-level
  - [ ] Option 3: Cancel
- [ ] Wire modal into SectionHeader delete action

## Phase 6: Polish & testing
- [ ] Add CSS styling (`.task-section-header` + hover/group-hover states)
- [ ] Manual testing on Collections and Inbox pages
- [ ] Test all CRUD operations
- [ ] Test section reordering
- [ ] Test deletion modal with each option choice
- [ ] Verify cross-tab sync (useSync + publishEvent)
- [ ] Integration test: create → edit → reorder → delete
- [ ] Update CLAUDE.md with section feature usage

## Commits made
- `4c3f2a7` - feat: add section support to drag-drop system (phases 1-3)
- `08edeaf` - feat: add SectionHeader component and i18n keys (phase 4a)
- `4e73604` - feat: integrate sections into CollectionsPage (phase 4b)
- `5aff5d7` - fix: add section import and prepare InboxPage for sections (phase 4c partial)

## Current status
Phases 1-4b complete. Phase 4c partially done (state/queries ready, render pending). Phase 5-6 not started.

**Next step:** Complete InboxPage render + handlers (straightforward copy of CollectionsPage pattern, ~30min work).
