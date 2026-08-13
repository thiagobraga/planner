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

## Review findings (2026-08-07) — spec verified against code

Checked every file the plan lists against `git diff`/current source. Task list's checkboxes are accurate: Phases 1-4b done, 4c half-done, 5-6 not started. One **critical bug** found that isn't yet tracked, likely the source of "screen not reliable":

1. **CRITICAL — new tasks inside a section always drop to top-level.** `apiCreateTask` (`app/src/api/client.ts:315`) has no `sectionId` field in its input type, and neither call site that creates a real task (`handleEditCommit` in `CollectionsPage.tsx:293`, temp-row commit path) passes one. `buildSectionGroups` groups strictly by `task.sectionId === section.id`, so any task added via Enter-below inside a section, or via the global add-task form, is created sectionless and immediately renders in the top-level group — even though the user typed it directly under a section header. This is the flow a user hits first when trying the feature, so it's the most likely cause of "not reliable."
2. **Delete has no confirmation at all yet.** `handleDeleteSection` (`CollectionsPage.tsx:446`) calls `apiDeleteSection` immediately on click, with a `// TODO` comment and an error swallowed by `.catch(() => {})`. The spec's required 3-option modal (Delete tasks / Move to top-level / Cancel) doesn't exist — this is a destructive action with zero confirmation, worse than the spec's baseline.
3. **Section reordering is a stub.** `onReorder={() => {}} // TODO: implement section reordering` (`CollectionsPage.tsx:661`). `SectionHeader` is already wrapped in `useSortable`, but nothing consumes drag-end events for section-kind items.
4. **No per-section "add task" row.** Unlike HabitsPage's per-group "+ Novo hábito", Sections only has one global add-form at the very bottom of the page, after every group. There's no direct way to add a task scoped to a section without dragging an existing task in (and bug #1 means even Enter-based creation inside a section mis-scopes anyway).
5. **`buildSectionGroups` mutates state in place.** `sections.sort((a, b) => ...)` (`CollectionsPage.tsx:78`) sorts the `sections` state array by reference on every render instead of `[...sections].sort(...)`. Currently harmless (order is stable) but a latent bug if sort ever becomes render-dependent.
6. **InboxPage render pending** — confirmed matches `task.md`: state and section query exist, but no `buildSectionGroups`, no per-section render, no add-section button, no CRUD handlers wired. User has asked to prioritize this explicitly.
