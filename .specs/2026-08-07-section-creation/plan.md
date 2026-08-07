# Feature: Allow users to create Sections in Inbox & Collections pages

## Context

Planner already has backend Sections (database, services, API endpoints) but zero UI for users to create/manage them. Sections are task groupings — visual separators within a collection/inbox that organize tasks.

Backend tested, ready. Frontend has `sectionId` field on tasks but never surfaces it. Goal: Mirror HabitsPage's "+ Novo grupo" pattern onto Collections/Inbox pages.

## Approach

Replicate HabitsPage UX (temp-row + shared editing state) onto task pages. Reuse DailyPage grouping pattern (multiple TaskList instances, one per section).

### End-to-end flow

1. **Backend:** Section API already exists. Expose inbox collection UUID so frontend can fetch/create sections.
2. **Frontend drag-drop:** Add section as a drop-target kind. Tasks crossing section boundary update `sectionId`.
3. **UI:** Render per-section headers + TaskLists. Inline "+ Novo seção" add button.
4. **CRUD:** Create (temp ID), rename (double-click), delete (modal: Delete tasks / Move to top-level / Cancel), reorder (drag section header).

### User decisions

- Sections are **draggable/reorderable** on both pages (like habit groups)
- **Delete prompt:** Show modal with three options—no silent cleanup
- **Styling:** Inbox sections match Collections style (uppercase header, tracking-widest)

## Files modified

### Backend
- `api/src/services/viewService.ts` — expose `inboxCollectionId`

### Frontend types & API
- `app/src/types/drag.ts` — add `SectionDropData`, `'section'` drop kind, update `TaskOrderScope`
- `app/src/stores/taskStore.ts` — add `Section` interface
- `app/src/api/client.ts` — section CRUD functions, extend `TaskUpdateInput` + `TaskMoveInput` with `sectionId`

### Frontend drag-drop  
- `app/src/hooks/useTaskDrag.ts` — handle section drop kind in `resolveMove()`
- `app/src/components/TaskList.tsx` — accept `sectionId`, build drop data

### Frontend UI
- `app/src/components/SectionHeader.tsx` — new component (drag handle, inline edit, delete menu)
- `app/src/pages/CollectionsPage.tsx` — fetch sections, group tasks, render per-section, wire CRUD handlers
- `app/src/pages/InboxPage.tsx` — same as Collections (mirrored)
- `app/src/i18n/locales/{pt-BR,en}.ts` — `'page.newSection'` keys

## Verification

- Manual: Collections/Inbox pages, create section → add tasks → move between sections → delete section (modal options)
- Integration test: create → edit → reorder → delete with each modal choice
- Sync test: open two browser tabs, section changes appear on both

## Known edge cases

- **Deleting section:** Backend sets `tasks.section_id = NULL`. Frontend modal lets user choose: delete tasks or move to top-level.
- **Cross-collection drag:** Task changing collection resets `section_id = NULL` (existing backend behavior).
- **Inbox scoping:** Inbox is internally a collection but frontend sees `collectionId: null`. Solution: expose real UUID in view response.
