# BulletPlanner development home

## Context

Development currently spans ideas in BulletPlanner, specifications in `.specs/`, and GitHub issues/PRs. Each can become a competing backlog, making priorities and progress hard to trust. The goal is not to reproduce all of Notion before using Planner: it is to make writing, deciding, and following development work possible in one calm place.

User decisions: **development home first**. The latest refinement supersedes the earlier note-per-plan model: **a development plan is a real parent task/card; its rich description holds the plan text and embedded real subtasks**. Standalone notes remain available, including capture in Daily and Inbox. Clicking a task or note opens one shared right-side detail panel. Execution order, slice queue, milestones, and corrections found while verifying live in `task.md`; open questions in `questions.md`. Where `task.md` corrects a line number or decision below (shared contracts as mirrored files, Window control moving to the Planner menu, migration 053), `task.md` wins.

## Primary goal

Capture tasks and notes in Daily or Inbox, organize development work as Kanban parent tasks, and open any item to write or read its complete plan. Embedded subtasks, card previews, task-only detail view, progress, and agent updates all operate on the same task records.

**First usable release:** collections split view (tree left, selected collection right), task/note detail sidebar, rich descriptions, parent cards with five-subtask previews, full-content/task-only views, live progress, agent tools, and a verified pilot import. No prerequisite to complete guest mode, add a separate Notes workspace, or redesign all settings.

## Ownership and working rules

| Information                                      | Authority                             | Other locations                                |
| ------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| Ideas, decisions, plans, priorities, work status | BulletPlanner                         | Read-only exports when needed                  |
| Code, tests, contracts tied to a revision        | Git                                   | Linked from notes/tasks                        |
| Review, CI, merge, releases                      | GitHub                                | Links and human/agent updates in Planner       |
| External bug reports                             | GitHub issue thread                   | One linked Planner task when accepted for work |
| Architecture/design rules                        | `CLAUDE.md`, `DESIGN.md`, source docs | Referenced, not migrated as live task lists    |

- One collection for ongoing product development, not a new collection per agent session. One parent task/card per initiative; its description owns the plan, its descendants own actionable work, and comments hold progress/evidence. Standalone notes are for writing that does not represent completable work. https://planner.thiagobraga.dev/collection/5a0f4e37-e825-49b0-8844-30e0acbc9510 dev > bulletplanner.org
- Suggested board states: Backlog, Ready, Doing, Review, Done. Use existing statuses rather than a second agent-status system. Keep one main initiative Doing; treat safety fixes as explicit exceptions.
- A PR being opened is not completion. Move work to Review; completion needs its acceptance criteria and applicable merge/deploy verification.
- Link GitHub work first. Do not build bidirectional synchronization or duplicate every GitHub event.
- After cutover, agents read/update the canonical parent task, document, and subtasks. A local snapshot includes parent task ID, document revision, source link, and export time; it is never silently written back.
- If Planner is unavailable, a snapshot permits reading only. Report progress as unsynced; reconcile explicitly on reconnect rather than inventing another canonical backlog.

## Engineering constraints and PR #460 alignment

PR #460 (`docs(specs): add untangle-codebase analysis`), reviewed at commit `f24f1b0d663d54991ed9b30096aeea3045f0dc68`, contains analysis and a skill, not implemented fixes. References below are to `.specs/2026-11-18-untangle-codebase/decision-log.md` on that PR. Recheck findings against the implementation branch; neither merge the PR nor run its whole-codebase refactor skill as part of this plan.

- **Strict file limit: under 420 lines, maximum 419.** Applies to every new or modified handwritten source, test, and documentation file in this work. Aim for 200-300 lines. Check counts before and after edits. Generated files, lockfiles, snapshots, and immutable historical migrations are excluded; new handwritten migrations stay small.
- Split touched oversized files by responsibility before adding behavior. In particular, the observed `taskService.ts` (484 lines), `CollectionsPage.tsx` (520 lines), and any larger board/controller files cannot grow. Do not reformat/minify code to pass the limit or make a single oversized test file.
- Small files must also be reviewable: one concern per module, explicit inputs/outputs, no hidden global coordination, circular imports, giant controllers, or barrels that hide coupling. Types stay in dedicated type/contract files, never inferred by importing UI components or services.
- Separate behavior-preserving extraction from feature changes into small commits/PR slices. Each slice has its tests and acceptance criteria; no repository-wide cleanup prerequisite. Preserve coverage during extraction and remove dead code/tests only after verifying callers and replacement behavior coverage.
- **Tests first for every behavior change.** Add and run a failing regression/acceptance test, implement, run it green, then refactor. The PR's suggestion to do test cleanup last does not defer new tests or justify deleting the safety net first.

| PR finding | Applied boundary in this plan | Scope guard |
| --- | --- | --- |
| F1, lines 35-53: divergent task caches, mappers, sync, optimistic writes | One task mapping/query-key module and task mutation/reconciliation layer for embedded task blocks, the detail panel, and existing task surfaces. React Query owns server data; document drafts and UI selection remain separate. No fourth task cache. | Extract and adopt the touched paths incrementally. Do not require merging all list pages before delivering notes. |
| F2, lines 55-66: inconsistent transaction/activity/sync ownership | A small transaction runner owns commit/rollback, activity in the transaction, and event dispatch after commit. Domain modules supply operations; actor context comes from a plain context module, not middleware imports. | Apply to note/task/embed/batch/claim/comment paths used here, not every service in one PR. |
| F3, lines 68-77: divergent structural changes and route-only validation | Shared service validation and one structural task-move path for REST, MCP, and imports. Reuse collaborator access checks, hierarchy rules, and task formatting. | Never implement reparenting or collection moves again inside note/MCP tools. |
| F10, lines 123-129: duplicated contracts | One dependency-free shared contract source for `SyncEvent` and new document/reference wire types, consumed by both packages. Verify both build/test/Docker contexts include it. | Do not move unrelated password, palette, or credential contracts in this feature. |
| F6/F7, lines 94-107: shortcut collisions and unordered preferences | Editor keys respect focus and `defaultPrevented`; progress display uses the revisioned document. Reuse the existing preferences path for actual global preferences. | No separate preference writer, localStorage fallback, or whole settings/command-registry rewrite. |
| F4/F8, lines 79-83 and 109-117: dates and revoked access | Keep imported date-only values as ISO days; test against real PostgreSQL and non-UTC zones. Verify revoked collaborators stop receiving note/task socket payloads before shipping shared notes. | Fix demonstrated blockers in focused slices; credential consolidation, rate limits, and full date cleanup stay separate. |
| Sections 2 and 4, lines 145-186: dead surfaces and weak tests | Use live routes/components; real DB/Redis fixtures, real application middleware, shared frontend builders, observable behavior assertions. | Do not revive `TaskDetail`, `taskStore`, or copy a sync handler into its own test. No blanket deletion based only on the report. |

## Verified starting point and limits

- `api/src/types/task.ts:19` already includes `parent_task_id`; `CreateTaskInput` has `parentTaskId` and `type: 'task' | 'note' | 'event'` at lines 42-58. Reuse these identities, not the obsolete proposed `parent_id` schema.
- Nesting exists up to depth 5: `api/src/services/task/validation.ts:4`, `app/src/utils/taskTree.ts:12`. Preserve existing hierarchy and behavior, including established completion semantics.
- `api/src/services/taskService.ts` is now 484 lines; focused access, move, validation, events, and completion modules already exist. The agent spec's 1975-line service observation is obsolete.
- Tasks and notes are one `tasks` table distinguished by `type` (`api/src/types/task.ts:58`); `description` is a plain text field today and `BoardCard.tsx:82` renders it whole. Attach one optional rich document to either kind rather than adding a second note entity or a Notes workspace.
- Plain click on `TaskItem.tsx:222` currently only selects the row; double-click starts rename (`:252`). `BoardCard.tsx:28` has no open action, and `BoardCardChecklist.tsx` renders every child with no cap. These are the exact behaviors Phase 1 and 2 change, so characterize them with tests first.
- No Tiptap/Lexical/ProseMirror/Markdown editor dependency found in `app/package.json`.
- `TaskDetail.tsx:28` contains a textarea and local-only comments/subtasks. Its only discovered component consumers are tests; do not wire the feature into this apparently unused panel. Use active collection/list/board paths.
- Current MCP registration is in `api/src/mcp/server.ts:21`; write tools are scope-gated. `api/src/mcp/tools/collections.ts:9` only lists collections/labels. Existing `notes` tool parameters refer to task descriptions, not standalone documents.
- Reuse `recordActivity()` (`api/src/services/activityService.ts:44`) and `publishEvent()`/`buildEvent()` (`api/src/services/syncService.ts:105,120`) behind the scoped mutation pipeline. Current task wrappers (`api/src/services/task/events.ts:6`) fire and forget; do not copy that pattern into new modules.
- Current `commentService.ts` has no activity/event calls; adding an MCP comment tool alone would not meet live human-visible progress requirements. Include that service path in the transaction/activity/sync work.
- `useCollectionTasks.ts:51` still takes page-local task arrays/setters. `stores/optimistic.ts` is not the unified cache/mutation layer proposed by F1; do not treat those refactors as already available.
- `api/src/test/fixtures.ts` from the PR is a proposed fixture module, currently absent. `api/src/index.ts:235` already exports the real app; reuse it when safe, extracting a small app factory only if startup side effects prevent isolated integration tests.
- Live GitHub check found existing performance PRs #436 (ready), #437 and #438 (draft). Do not recreate their work or infer completion from spec checkboxes.
- Settings spec says prototype awaits approval. The user's statement that it is designed does not establish approval.
- The production collection's contents and live production readiness were not inspected. Inventory and deduplication against that collection remain required before import.

## Product behavior

### Capture anywhere, organize when ready

- Daily and Inbox continue to accept quick tasks and notes. Writing never requires creating a plan, moving to a dedicated Notes page, or choosing a collection first. Existing date/Inbox placement rules remain intact.
- Ordinary tasks stay lightweight. Any task can grow into a plan by adding a rich description and subtasks. Standalone notes use the same editor and detail panel, without completion controls or required dates.
- A migrated initiative is a normal parent task in the development collection. `plan.md` becomes its description, not a separate note linked to a substitute plan card.

### One right-side detail panel

- Plain click/tap on a noninteractive task row or card opens that item's details on the right without completing it or leaving the current Daily, Inbox, or collection view. Clicking a subtask title opens that subtask, with a parent breadcrumb to return.
- Completion control only completes/reopens; menus, links, date controls, text selection, and drag gestures never also open details. Ctrl/Cmd-click retains multi-select without opening the panel. Do not trigger opening from drag-end pointer events.
- Preserve fast inline creation and explicit inline rename (Shift+Enter/context action). Plain click no longer means selection-only; preserve double-click rename without losing drafts or stealing editor focus. Provide an accessible Open details action rather than repurposing the existing Enter-to-add-below keyboard behavior silently.
- Desktop: one nonmodal, docked right panel, initially about 480px wide, with the board still usable. Inside the collections split view it is the third pane (tree, content, panel) from about 1280px and an overlay sheet below that. Sticky header holds title, close, parent breadcrumb when relevant, and completion for tasks only. Below: compact properties, description/subtasks, then comments/activity. Use existing date/status/label controls; secondary metadata stays collapsed until needed.
- Narrow screens, including 390px: the same detail content becomes a full-width sheet, not a squeezed desktop sidebar. Preserve background position; closing returns focus to the originating item. Desktop focus is not trapped; the mobile sheet has dialog focus containment. Escape closes the active overlay first and respects unsaved changes.
- Use one detail controller in the app shell, keyed by item ID, not a panel per page or separate task/note implementations. The controller stores selection/open state, not another task-data cache. Loading, missing, deleted, and permission-denied states are explicit.
- Panel shows **Full content** by default and an **Only tasks** toggle. Full content keeps prose, headings, code, links, and embedded tasks in their exact text locations. Only tasks hides prose and presents the full canonical descendant tree for tasks; notes show their linked tasks. The toggle changes presentation only, never the saved document, hierarchy, or completion.
- Tasks created outside the description still appear in Only tasks and in a compact “Other subtasks” section in Full content. Nothing disappears because it lacks an editor block. Switching modes or items preserves unsaved drafts, caret/scroll where practical, and asks before discarding failed saves.

### Rich descriptions with real subtasks

- Tasks and notes share a versioned rich document body. Formatting appears through selection controls and a small insert menu, with keyboard equivalents. Preserve journal styling and 24px rhythm; no database-builder controls or separate editor for each item kind.
- Creating a task block inside a task description creates a real child through `parentTaskId`, in the same collection, and inserts its stable task reference at the caret. Nested checklist structure maps to actual parent/child relationships, within the existing depth limit. Headings and ordinary bullet lists do not become tasks.
- An embedded block stores block ID and task ID, not independent copies of title/completion. Text editing, checkbox updates, card previews, and agents all use canonical tasks.
- Adding an existing task as a subtask explicitly reparents through the existing structural move service after showing the change. A reference alone never silently moves someone else's work. Reject cycles, self-links, cross-collection attachments, and depth overflow.
- Standalone note task blocks are references, not ownership: a new task created there belongs to the same collection but is not a child of a non-completable note. Reference-only links do not inflate another plan's subtask progress.
- Moving a block within prose changes placement, not parentage or board order. Removing a block unlinks it, leaving the child visible under Other subtasks/Only tasks. Deleting a task is a distinct confirmed action. Reparenting elsewhere makes its old embedded block a reference-only link; it leaves the former parent's preview/progress.
- Deleting a note preserves referenced tasks. Deleting a parent task must explicitly disclose the existing descendant cascade and affected count; no description edit or note conversion may trigger it. Completing a parent retains existing cascade behavior with clear UI; completing the last subtask does not automatically close the parent or skip Review.
- Markdown checkbox conversion runs during explicit import or insertion, not by repeatedly parsing prose on save. Preserve actual nested work; do not duplicate it into a second checklist data store.
- Visible saving/saved/error states. Concurrent writes use document revisions; a remote update cannot overwrite a dirty draft. Account content is not persisted to localStorage. Failed saves retain the in-memory draft and offer explicit download; warn before leaving, without claiming crash-proof offline persistence.

### Compact parent cards and progress

- A parent card shows its title, compact metadata, a short plain-text description excerpt, progress, and at most **five direct subtasks** in canonical order. Child counts indicate deeper nesting; the full hierarchy is available in details. The five-row cap is a preview limit, not a data or nesting limit.
- More than five children adds **Show all N subtasks**, opening that parent's panel in Only tasks mode rather than expanding a tall Kanban card. Exactly five shows no overflow link. Clicking a child checkbox affects only that child; clicking its title opens the child's details without bubbling to the parent.
- Existing board drag/drop and full subtree IDs remain intact when some rows are hidden. Preview slicing must not truncate moves, progress, export, or API data. Keep existing completed-item visibility behavior and make counts unambiguous.
- Progress counts unique actionable leaf descendants, excluding the parent, notes/events, and reference-only links. An empty plan shows “No subtasks,” not 100%. Count, percentage, bar, and ring share the same accessible numbers; presentation choice is stored on the document, not in task status.
- No separate note-filtered board is needed for this release. Normal parent-task cards are the development board; notes retain their existing type behavior.

## Phase 0: Reconcile scope and establish safe foundations

**How this serves the primary goal:** Prevent rebuilding shipped features or migrating stale plans into a new source of confusion.

- [ ] Read current source, all five named specs, their task files where present, affected callers, and current worktree/PR status before editing. Preserve uncommitted main-tree work.
- [ ] Reconcile PR #460 findings with the branch and coordinate overlapping refactors. Take only the boundaries listed above; adopt an already-landed implementation instead of creating a parallel helper.
- [ ] Record the under-420-line rule in the approved feature spec and project `CLAUDE.md` during implementation. Add a small changed-file line-count check to the existing validation entry point, including tests for 419/420 lines, terminal newlines, and explicit generated-file exemptions. Baseline untouched oversized files rather than splitting the entire repo.
- [ ] Establish shared test builders and real DB/Redis fixture lifecycle before extraction. Reuse existing integration setup; add missing focused fixtures without replacing working suites wholesale.
- [ ] Deliver foundation slices separately: (a) characterize/extract oversized touched modules, (b) shared wire contracts and transaction/activity/event ownership, (c) shared task mapping/query keys and reconciliation for touched surfaces. Each slice passes its regression tests before feature work builds on it.
- [ ] Inspect the target collection using an authorized connection or user-provided export. Do not scrape credentials or create a token automatically. Compare existing ideas/tasks with spec candidates.
- [ ] Map each initiative to one canonical parent task/document and existing PR/task links. Mark requirements as implemented, pending, uncertain, or superseded based on evidence; do not turn every unchecked historical box into new work.
- [ ] Isolate each slice under `.worktrees/<slice-slug>` on a semantic branch cut from fresh `main`, with its own dependencies and stack (`COMPOSE_PROJECT_NAME`, subdomain, hooks setup per `CLAUDE.md`). Follow project draft-PR, certificate, test, and review workflow when execution is authorized.
- [ ] Bootstrap `.specs/<execution-date>-development-home/plan.md` and `task.md` only after plan approval. Keep the current repo convention until a verified migration supports replacing it.
- [ ] Verify available migration numbers and actual note, account export/delete, authorization, search, and board behavior. Never reuse the agent spec's hard-coded migration number.
- [ ] Confirm panel design against `DESIGN.md` (flat tint and 1px border, Lora, 24px rhythm, accent at most 10%, inline panel before any modal). Before building, show the user a desktop and 390px mock of the panel and a six-subtask card for approval; add the approved panel to `DESIGN.md` and the styleguide only after that. Ask before deviating from the design system.
- [ ] Use Tiptap's open-source editor, not a custom contenteditable implementation or hosted document service. Pin compatible packages after checking current docs and licenses.

**Allowed patterns/docs:** `useEditor`, `EditorContent`, and `StarterKit` from https://tiptap.dev/docs/editor/getting-started/install/react; `Node.create`, `addNodeView`, `ReactNodeViewRenderer`, `NodeViewWrapper` from https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react; `editor.getJSON()` and restoring JSON content from https://tiptap.dev/docs/guides/output-json-html. These docs were fetched during planning. Follow existing MCP `registerTool`/`runTool` patterns; no new model provider or agent runtime is needed.

**Verify:** source-of-truth mapping, isolated baseline checks, explicit inventory of what remains unknown. No production writes in this phase.

## Phase 1A: Collections split view (ships first)

**How this serves the primary goal:** Move between initiatives in the development collection with one click while the tree stays in place, so the plan board and detail panel always have a stable home.

Today `/collections` (`CollectionsIndexPage.tsx`, 361 lines) lists the tree and each row calls `navigate('/collection/:id')` (`:39`), replacing the whole page. `/collection/:id` is a separate route (`App.tsx:69-70`, `CollectionsPage.tsx`, 520 lines).

- [ ] **Behavior.** `/collections` opens as it does today: the "Coleções" tree on the left with the same rows, colors, rename, create, delete, and row menus. With nothing selected the right side stays empty (no text, no button). The selected collection and split view are remembered in memory: leaving Collections and coming back reopens them, and a page reload starts clean. Clicking a row loads that collection on the right (title breadcrumb, View menu, quick add, list/columns exactly as the page renders today) and pushes `/collection/:id`, so back/forward move the selection. The selected row is marked `aria-current="page"` and bold, as in the reference screenshot.
- [ ] **Nothing remounts on selection.** Tree scroll position, open menus, an in-progress rename, and expansion state survive clicking another collection. Rows are real links: Ctrl/Cmd/middle-click open a new tab, a plain click on the selected row does nothing. Deep links to `/collection/:id`, search results, breadcrumbs (`CollectionBreadcrumbs.tsx:68`), and the top-bar highlight (`TopBarItem.tsx:13`) render the same split view.
- [ ] **Layout.** Tree pane fixed at 264px (11 baseline units), content flexible with a 480px minimum, flat tint and 1px border, no new shadows. With the detail panel open (Phase 1): three panes from about 1280px; below that the panel opens as an overlay sheet over the content and the tree stays. Below 768px keep today's single-pane flow: `/collections` is the full-width list, `/collection/:id` is full-width content with a way back to the list. Mobile behavior must not change.
- [ ] **Structure.** Add a `CollectionsLayout` route element that renders the tree pane and an `<Outlet />` for both routes. Extract the tree from `CollectionsIndexPage.tsx` into focused modules (rows, row actions/menu, create/rename/delete handlers, tree hook) reusing `buildCollectionTree` and the `['collections']` query; no second collections cache. Before adding the layout, split `CollectionsPage.tsx` (over the limit) into hooks and components in behavior-preserving commits covered by characterization tests. Key the content by collection id so local state (inputs, editing row, section drafts) resets on selection and stale tasks never flash. Do not revive the unused `CollectionTreeNav.tsx`; remove it only in a separate commit after confirming no importer.
- [ ] **Edge states in the right pane, tree always visible.** Unknown id or no access shows "Collection not found" without leaking names. Deleting or archiving the open collection returns to the empty state (today's `navigate('/collections')` at `CollectionsIndexPage.tsx:265`). Rename and recolor update tree and header from the same query. Remote task, section, and collection changes refresh the open collection (existing gap: `CollectionsPage.tsx:67-75` ignores some remote events), so cover that with a test.
- [ ] **Accessibility.** Tree rows stay keyboard-focusable; focus stays on the clicked row after the right pane loads; the right pane is a labelled region with a heading; loading is announced politely. No focus theft from rename inputs or the quick-add field.
- [ ] **Tests first, each file under 420 lines.** Characterize existing index rows (rename, create, delete, menus, colors) and the collection page before moving code. Then: route matrix (`/collections`, `/collection/:id`, unknown id), selection and `aria-current`, no remount (tree scroll offset and an open rename input persist across a click), back/forward, deep link, 390px single-pane, delete open collection, API-side change appears live. Existing `topBarNav`, `collectionsPageSubtitle`, `kanbanListAddTask`, and section-column e2e specs must keep passing.
- [ ] **Out of scope here:** collapsible or resizable tree, favorites in the tree, new drag targets, tree keyboard arrow navigation.

**References:** `app/src/App.tsx:57-70`, `app/src/pages/{CollectionsIndexPage,CollectionsPage}.tsx`, `app/src/components/collections/CollectionBreadcrumbs.tsx`, `app/src/components/nav/TopBarItem.tsx`, `app/src/hooks/{useCollectionBreadcrumbs,useCollectionTasks,useCollectionSections}.ts`, `app/e2e/{topBarNav,collectionsPageSubtitle,kanbanListAddTask}.spec.ts`.

**Verify:** the reference screenshot layout reproduces at desktop; clicking through six collections never remounts the tree; narrow view is unchanged; no new request storms (one collection view fetch per selection).

## Phase 1B: Toolbar buttons look the same (small UI slice)

**How this serves the primary goal:** The toolbar sits above every plan board and the detail panel; consistent controls keep it calm and scannable as the view menus gain more use.

Today the toolbar mixes three looks: `Hoje`, previous, next and the range picker are `Button` secondary/xs (`DateNav.tsx:74-95`, 20px high, 11px text, bordered), while `Visualizar`, `Janela` and `Group: X` are borderless 14px text triggers (`MenuButton.tsx:68`, `.page-menu-trigger` in `styles/toolbar.css:31`). The range pickers also render bold (`DateNav.tsx:88` on Daily, `WeekSelector.tsx:95` on Habits).

- [ ] **Menu triggers become small buttons.** `Visualizar`, `Janela`, and `Group: X` (all go through `MenuButton`, used by `ViewMenu`, `WindowMenu`, `GroupByMenu`) render with the same secondary xs button styling as `Hoje`: same height, padding, radius, border, hover/active/focus, 11px text, and the existing 12px chevron. One definition: reuse the `Button` component for the trigger if it can carry the ref and ARIA wiring `MenuButton` needs, otherwise export its class tokens from `ui/Button.tsx` and use them in both places. Keep `aria-haspopup`, `aria-expanded`, `aria-controls`, the open state (`is-open` look), and keyboard behavior unchanged.
- [ ] **Same layout for every select-like control in the page toolbar.** Inventory all triggers inside `.page-toolbar` and the phone bar (Daily, Habits, Inbox, Collections, Group by); each matches `Hoje`. Panels, sheets, items, and shortcut hints inside the open menus do not change. Settings selects (`CustomSelect`) are out of scope.
- [ ] **No bold on range pickers.** Remove `font-semibold` from the trigger in `DateNav.tsx:88` and `WeekSelector.tsx:95`; keep their tracking, uppercase, fixed-width spans, and the bold marker for today's day inside the calendar popovers (`DateNav.tsx:134`, `WeekSelector.tsx:158`), which signals state, not style. Confirm the fixed widths still fit after the weight change at desktop and 390px.
- [ ] **Row fit and touch.** The row keeps its shedding order (compact date, then Today, then Window folds into View). Buttons are 20px high, so on phones keep a 44px touch target by enlarging the hit area (`@media (pointer: coarse)`) without changing the look. Check the row at 1280, 1024, 768, and 390px for wrapping or overflow.
- [ ] **Design docs.** The change is requested explicitly, so update `DESIGN.md:333` (View and Window are small secondary buttons matching Today, not desktop-style text menus) and the Styleguide page; delete the now unused `.page-menu-trigger*` rules after confirming no other user.
- [ ] **Tests first.** Update `toolbar.test.tsx` to assert by role and name that every toolbar trigger exposes the shared button styling and keeps its ARIA state, that no range trigger computes a bold weight, and that menus still open, close, and navigate by keyboard. Keep e2e selectors `.date-nav-trigger` (used by `weekSelector`, `dailyAccessibility`, `habitsToolbar` specs) working. Capture before/after screenshots at desktop and 390px under `app/dist/screenshots/`.

**Verify:** all toolbar controls read as one family; no bold range label; menus behave as before; no layout regression on any page that uses `PageToolbar`.

## Phase 1: Shared detail panel and durable rich descriptions

**How this serves the primary goal:** Open any task or note from the current view and give its full plan a durable writing surface.

- [ ] Write failing open/close, gesture-isolation, persistence, permission, conflict, and editor tests first. Characterize existing row selection, inline editing, keyboard shortcuts, and card drag behavior before changing click handling.
- [ ] Add a document table keyed to existing task/note entry IDs, not restricted to `type='note'`: versioned JSON, schema version, revision, and timestamps. Keep title, collection, parent, dates, and status on existing entries. One authoritative document body per entry.
- [ ] Create focused document read/write services and thin routes, with collection authorization, compare-and-swap revision checks, safe URL/node validation, and bounded size/depth. New wire types belong in the shared contracts layer.
- [ ] Seed existing plain descriptions losslessly on first rich edit; title remains separate. Once a document exists, `description` becomes a derived plain-text summary/export representation, not an independently editable second source. Guard legacy REST/MCP description writes against silently replacing rich content; return a clear revision-aware editing requirement. Test this boundary explicitly.
- [ ] Record activity through the scoped transaction runner and publish only after commit. Use transaction results for the committed response. Publication failure cannot masquerade as rollback or make retries duplicate writes. Central reconciliation refreshes item/document queries without replacing dirty drafts.
- [ ] Add one lazy-loaded detail panel host/controller at `AppShell`, with open-item wiring from Daily/Inbox/Collections rows, board cards, and subtask rows. Reuse shared query state. Keep rich editor code out of the initial Daily bundle.
- [ ] Build focused panel header, properties, document section, and comments/activity components. Do not reactivate the unused `TaskDetail` with local-only subtasks/comments. Reuse useful controls through live components and actual services instead.
- [ ] Implement desktop dock/mobile sheet, focus restoration, close/escape handling, parent breadcrumb, loading/deleted/denied states, and dirty-draft protection when switching items. Provide an accessible Open details action and preserve explicit inline editing/multi-select.
- [ ] Include task and note document bodies in authorized search and account export/restore/delete. Export lossless JSON plus readable Markdown. Audit task/note type conversion and parent deletion so documents/descendants cannot disappear through an incidental editor action.

**References:** `app/src/components/{AppShell,TaskItem,TaskList}.tsx`, `app/src/components/board/{BoardCard,BoardCardChecklist}.tsx`, `app/src/types/{task,board}.ts`, `app/src/hooks/useSync.ts`, `api/src/routes/index.ts`, `api/src/services/task/access.ts`, and the Tiptap docs above.

**Verify:** capture both kinds in Daily and Inbox; click opens without completion; checkbox/menu/drag does not open; keyboard/multi-select/inline rename still work; create/edit/reload/export full descriptions; two-tab conflicts preserve drafts; mobile close returns to the original row; unauthorized data never appears.

## Phase 2: Embedded subtasks, five-row cards, and task-only view

**How this serves the primary goal:** Make each Kanban plan a real parent task with one consistent subtree in prose, card preview, and full details.

- [ ] Add a `taskReference` editor node and a reference index derived from validated document content. Task parentage remains exclusively in `parentTaskId`; text placement is not a parallel hierarchy.
- [ ] Add an atomic create-and-embed operation: for a task owner create its child; for a note owner create a standalone task reference. Persist the new task, reference, and document revision together with an idempotent client operation ID.
- [ ] Extract transaction-capable task creation before extending oversized `taskService.ts`; reuse service validation, access, structural move, activity, and event boundaries. Attaching an existing child requires an explicit structural operation; prevent cycles/depth overflow and collection mismatches.
- [ ] Resolve embedded references and the full descendant tree in bounded batch queries. Share task mapping/cache/reconciliation with list and board surfaces, with no copied task arrays, per-block fetches, or unused `taskStore` dependency.
- [ ] Implement Full content/Only tasks as projections of the same data. Show nonembedded descendants as Other subtasks; keep drafts when toggling, retain hierarchy, and allow completion/open-child actions from either projection.
- [ ] Refactor `BoardCardChecklist` into focused preview and row components. Display the first five direct children and Show all N for overflow; wire overflow to the parent's task-only panel. Keep the complete subtree for drag/drop and progress regardless of rendered rows.
- [ ] Produce a bounded plain-text description excerpt for the card instead of rendering the entire rich description. Use one pure unique-leaf progress calculation and a small presentation component for count/percentage/bar/ring.
- [ ] Protect block unlink, task deletion, note deletion, parent cascade confirmation, reparented references, and copy/paste identity. Cross-collection moves must reject unresolved document references or explicitly reconcile them within the same authorized operation, never leak data.
- [ ] Replace timeout-driven rollback in adopted paths with outcome-aware rollback that cannot overwrite newer successful edits. Do not accept synthetic offline transport responses as committed document revisions. Test delayed success, true failure, concurrent writes, and reconnect/refetch.

**References:** `api/src/services/taskService.ts`, `api/src/services/task/{move,completion,validation}.ts`, `app/src/utils/taskTree.ts`, `app/src/components/board/{BoardCard,BoardCardChecklist}.tsx`, `app/src/components/dnd/`, and `app/e2e/specs/board/subtask-reparent.spec.ts`.

**Verify:** zero/five/six children; hidden children remain counted/moved; overflow opens all work; Full content/task-only switching loses nothing; parent/child clicks target the correct item; updates from panel/board/agent converge; block removal preserves subtasks; note deletion differs safely from parent-task deletion; failed/retried creation is atomic.

## Phase 3: Agent workflow and pilot migration

**How this serves the primary goal:** Let agents use the same plans people see, and retire duplicate tracking for a small verified set.

- [ ] Add MCP read tools for full task/note document content/revision, task detail/descendants, comments, and activity; write tools for document block edits, child creation, statuses, and comments. REST, MCP, and imports invoke the same service validation/access/mutation path. Add comment activity/sync in the service, not the adapter. Structural edits use the canonical move path. Text-only task description writes cannot bypass document revision protection.
- [ ] Document edits address stable block IDs and an expected revision. Agents must not replace rich content fetched before a person's newer edits. Agent-created subtasks immediately appear in the parent's card and Only tasks view, whether or not placed in prose.
- [ ] Add bounded, transaction-safe, idempotent batch task creation using the same internal helpers as Phase 2. Server stores request identity and payload hash; same key with changed payload is a conflict, not an overwrite.
- [ ] Add atomic claim/release for parallel agent work. Derive actor identity from authenticated token/grant context, not a caller-supplied label. Claims have expiry and explicit recovery; a crashed agent cannot block a task permanently. Claims are coordination, not extra access rights.
- [ ] Show actor, claim, comments, and result links through active UI surfaces. Extend existing Integrations setup without waiting for the full settings redesign.
- [ ] Document the client workflow: read the parent task's plan, choose/claim a Ready subtask, update status, comment evidence/PR link, release claim, move to Review. Do not mirror private todo lists through fragile hooks or create a collection per session.
- [ ] Build a bounded Markdown import with dry-run preview. One spec folder becomes one normal parent task/card, with `plan.md` in its rich description. When `task.md` also exists, retain its text under a named section in the same description. Preserve headings, code, links, prose, and original bytes for recovery; unsupported constructs produce warnings, not silent loss.
- [ ] Convert selected checklist items into actual descendants and embed references at their original positions. Preserve `[x]` and `[~]` through mapped completion/status, hierarchy, and document order; headings/ordinary lists stay prose. Deduplicate overlapping plan/task checklists through reviewed mappings, not title guesses. Flag nesting beyond the existing depth limit, including the new plan parent, for review.
- [ ] Persist an import manifest keyed by user, repository/source path, source hash, and stable item mapping. Exact retries return prior results; changed input requires a preview/reconciliation, not another blind import or overwrite.
- [ ] Pilot the agent-tool and guest-mode specs after deduplicating against existing collection items. Reconcile the agent spec's obsolete hierarchy/service assumptions before creating actionable tasks. Import launch and settings plans only after pilot verification.
- [ ] Before any real import, produce the dry-run report (destination, parent cards/subtasks/documents to create or link, sensitive content warnings, expected counts). In an interactive run, show it for confirmation; in the unattended run, the assertion gate in the run protocol replaces the confirmation. Keep originals untouched. Verify backups/restoration before declaring production plans authoritative.
- [ ] Every real import writes a manifest and ships an undo that removes exactly what that manifest created, only where an item is still unmodified; modified items are reported, never deleted.
- [ ] Cut over each pilot individually after content/status/reference comparison and export round-trip pass. Mark its original as superseded with the canonical link/revision; retain it in Git history. Do not delete `.specs` wholesale.
- [ ] Update `CLAUDE.md` workflow only after cutover: Planner for plans/progress; repository for implementation artifacts and generated snapshots. Edit the real file, not its symlinks.

**References:** `api/src/mcp/server.ts:21`, `api/src/mcp/tools/tasks.ts:54`, `api/src/mcp/toolkit.ts`, `api/src/services/commentService.ts:74,83`, `api/src/services/activityService.ts:70`, `api/src/mcp/__tests__/server.integration.test.ts:64,209`, and `app/src/components/settings/ConnectAgentPanel.tsx`.

**Verify:** a real authorized MCP client reads a plan, creates a task once despite retries, claims it, comments progress, and updates the browser live; two claimants yield one winner; stale note edits conflict; read-only credentials cannot write; revoked credentials fail; repeated import creates nothing new and never overwrites user edits.

## Test contract for every implementation slice

Write tests alongside each slice, not as a final testing project. Keep each test file under 420 lines; split by behavior rather than introducing one comprehensive feature suite.

| Layer | Required coverage | Boundary |
| --- | --- | --- |
| Pure unit tests | Document schema, reference extraction, unique-leaf progress, import checkbox/status mapping, deterministic export, shared task mapper, changed-file size check | Small typed fixtures and deterministic clocks; assert outputs, not internal call order. |
| Service integration | Document revision conflicts, legacy description-write guard, parent/child attach cycles and depth, atomic create-and-embed, batch rollback/idempotency, claim races/expiry, comment attribution, move invariants, cross-account/collaborator permissions | Real PostgreSQL and Redis with isolated data and cleanup; no scripted SQL replies or mock DB/Redis success paths. |
| Mutation delivery | Activity rolls back with writes; failed transactions emit nothing; successful operations emit the intended events; post-commit read/publish failure never masquerades as rollback | Exercise the real runner/services; narrow deliberate outage injection is allowed. Assert stored data and observed socket/pubsub behavior, not copied handler logic. |
| REST and MCP | Equivalent validation, scopes, auth/CSRF, revision errors, invalid parents/sections, revoked credentials, actor propagation | Real app middleware and real MCP client. Do not force `req.userId`, build a fake app, or test only that routes call services. |
| Frontend behavior | Row/card/child open targets; checkbox/menu/drag isolation; multi-select/rename; 0/5/6-child previews; Full content/Only tasks preserves draft and hierarchy; save/conflict recovery; delayed-write protection; panel/list/board sync | Shared provider/router/React Query harness and task builders; mock only transport/socket boundaries where needed, not child components or the logic under test. |
| Playwright | Capture tasks/notes in Daily and Inbox; open/close desktop panel and mobile sheet; import a parent card with prose/subtasks; Show all opens task-only mode; agent changes appear live; two-user isolation and live revocation | Real running stack; roles/names first, stable test IDs only when needed. Use controlled clocks and condition-based waits, not sleeps or weekday skips. |

Preserve existing tests during structural extraction. Replace SQL-string assertions, class-order checks, tautological tests, and tests of copied handlers only within touched scope, after meaningful replacement coverage is green. Await all async work; no unhandled promises or `act()` warnings. Each PR states tests actually run, failures, and unverified behavior.

## Unattended run and deploy protocol

You said you will let this run in one shot, including deploying. That authorizes the actions below and nothing beyond them. How production deploys today (`.github/workflows`): merge to `main` runs CI (`2a` quality, `2b` security); `3.release.yml` opens a release-please PR; merging that PR creates the tag and calls `4.deploy.yml`, which builds, scans, and runs `scripts/blue-green-deploy.sh` over SSH in the `production` environment (migrate job, health checks, automatic rollback trap, previous image kept in `deploy/.previous-image`). `main` has no branch protection, so these gates are the safety net.

**Authorized:** worktrees and semantic branches; small Conventional Commits with the `Co-Authored-By` trailer; pushing own branches; draft then ready PRs; merging this plan's own PRs after green CI; merging the release-please PR; watching the deploy run and the public health check. **Not authorized:** merging or editing others' PRs (#433, #435-#438, #460) or rebasing onto unmerged ones; force-push; `--no-verify`; changing branch rules, secrets, workflows' permissions, or infrastructure; deleting or rewriting production data; touching uncommitted work in the main checkout (all work stays in worktrees, never stash or checkout there).

**Slice order, each from fresh `main`, one PR, one concern:** (1) changed-file line-count check and shared fixtures; (2) `CollectionsPage` split; (3) Phase 1A split view; (3b) Phase 1B toolbar buttons; (4) shared contracts and mutation runner; (5) documents and detail panel; (6) embedded subtasks, five-row cards, task-only view; (7) agent tools, claims, comment activity; (8) import/export with undo; (9) pilot import and cutover. Slices 1-3 and any UI-only slice need no migration.

**Gate for every slice before merge:** failing test first, then green; lint, type check, both builds; changed-file check (all handwritten files at most 419 lines); local stack browser check at desktop and 390px with screenshots saved under `app/dist/screenshots/`; PR checks all green. Fix root causes; never weaken or skip a test to pass.

**Deploy rules.** Merging to `main` does not deploy; the release PR does. Deploy after slices 3 and 3b (UI only, one release). Deploy each schema slice on its own so a rollback maps to one change. Migrations must be additive and backward-compatible (new tables or nullable columns, no renames or drops), because the previous color keeps running during the switch. Your go-live spec lists automatic off-server backups as not done, so before any deploy that includes a migration take a `pg_dump` snapshot and test-restore it into a scratch database; if that cannot be done unattended, merge the slice but hold its release PR and stop. After each deploy confirm the public router returns 200 for the app and `/api/v1/health`, the deployed version matches, and note the rollback command. A failed deploy is not retried blindly: let the script roll back, record the logs, and stop.

**Production import gate.** Import into the real development collection only through the app's API with a token you created in Settings > Integrations and placed in the environment; never create or scrape one. Proceed only when the dry-run report matches the expected counts exactly, there are zero ambiguous matches, every source is read-only, and the manifest and undo are verified on a scratch database first. Otherwise skip those items, leave the report, and continue with other work.

**Stop and report (do not push through):** same CI failure after two root-cause attempts; a test that would need weakening; a high or critical security finding in new code; a non-additive migration; a failed or unverifiable backup; any production health failure; an action not listed as authorized; low disk or a broken local stack. Everything not blocked continues.

**Run log.** Keep `.specs/<execution-date>-development-home/task.md` current per slice (branch, PR, commit, CI result, deploy run, screenshots, unverified items, stop reason). Final summary: shipped, deployed, held, and exactly what remains unverified. Never claim a check passed that was not run.

## Phase 4: Validate daily use and cutover readiness

**How this serves the primary goal:** Prove the app reduces tracking work before migrating everything or expanding features.

- [ ] Run focused unit tests, real PostgreSQL/Redis integrations, lint, type checks, builds, and Playwright tests in the isolated stack. Follow red-green-refactor for each behavior, with awaited asynchronous assertions.
- [ ] Run the changed-file size check: all new/modified handwritten files, including test helpers/suites, are at most 419 lines. Review module boundaries and import cycles too; line count alone is not proof of good structure. Build both packages and their Docker contexts against shared contracts.
- [ ] Run the shared task behavior suite against affected Daily, Inbox, Collections, note, and board surfaces. Verify real refetch/reconciliation after remote task/section/status/label changes and ensure an editor keystroke never also triggers a global page shortcut.
- [ ] Browser golden path: capture a task and note in Daily/Inbox; open each in details; write a parent plan with at least six subtasks among paragraphs; verify five-row card preview; Show all opens the complete task-only tree; switch back without losing prose; receive an agent update; export/reload and inspect another tab.
- [ ] Test edge cases: checkbox/menu/drag must not open; subtask title must not open its parent; inline rename/multi-select and keyboard shortcuts remain usable; desktop/mobile focus restoration; failed save while closing/switching; stale revision; deleted/moved task; parent cascade confirmation; revoked access; empty plan; duplicate references; import failure/retry; `[~]`; unsafe URLs/HTML; long documents.
- [ ] Capture desktop and 390px screenshots under the worktree's `app/dist/screenshots/` and link them. Check keyboard navigation, focus, mobile typing, console errors, and unchanged Daily/list/board behavior.
- [ ] Verify a representative large spec without per-task request fan-out or Daily bundle regression. Measure before/after rather than declaring performance acceptable from build success.
- [ ] Dogfood one real development block from plan through PR review. Success: no manual duplicate status updates, no lost writing, human-readable agent activity, and a clear Ready task next.
- [ ] Expand migration only after that gate. Keep the stack available for review; no automatic teardown or blanket production migration.

## Relationship to the five existing initiatives

| Initiative          | Treatment                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent task tool     | Revise and absorb the needed subset in Phase 3. Existing nesting/service split are reused; plugin distribution across every client is later.                                                                                                                                                                                         |
| Go-live performance | Finish/review existing #436-438 separately; avoid conflicting editor bundling changes. Not a prerequisite for the detail panel, but coordinate chip-name and bundle changes with it and measure the lazy editor cost.                                                                                                                                                                           |
| Settings redesign   | Preserve Penpot design and its approval gate. Only minimal integration controls belong in this work.                                                                                                                                                                                                                                 |
| Guest mode          | Next acquisition milestone after the development-home pilot. Keep its browser-only/no-anonymous-server-writes guarantees. Align document schema/export/import contracts, but do not implement two storage backends in this release. Rich descriptions and the detail panel require updating its plain-text rendering assumption when they enter guest scope. |
| Go-live             | Independent safety and launch checklist. Backups with tested restore, security fixes, and recoverability gate canonical data storage/public access. Pricing, marketing, billing, and infrastructure migration do not belong in this feature.                                                                                         |

## Relevant files

Existing integration points:

- `api/src/types/task.ts`, `api/src/types/activity.ts`, `api/src/services/taskService.ts`, `api/src/services/task/{access,validation,events,completion,move}.ts`
- `api/src/services/{collectionService,commentService,activityService,syncService,searchService}.ts`, `api/src/routes/{index,tasks}.ts`, `api/src/db/migrations/`
- `api/src/mcp/server.ts`, `api/src/mcp/tools/{tasks,collections}.ts`, `api/src/mcp/toolkit.ts`, `api/src/mcp/__tests__/server.integration.test.ts`
- `app/package.json` and lockfile, `app/src/App.tsx`, `app/src/pages/{CollectionsPage,CollectionsIndexPage}.tsx`, `.github/workflows/{3.release,4.deploy}.yml`, `scripts/blue-green-deploy.sh`, `app/src/components/{TaskItem,TaskList}.tsx`, `app/src/components/board/{BoardCard,CollectionBoard,WeekSelector}.tsx`, `app/src/components/toolbar/{MenuButton,DateNav,ViewMenu,WindowMenu,GroupByMenu}.tsx`, `app/src/components/ui/Button.tsx`, `app/src/styles/toolbar.css`
- `app/src/api/client.ts`, `app/src/hooks/{useSync,useCollectionTasks}.ts`, `app/src/stores/optimistic.ts`, `app/src/types/`, existing account data export UI/services, and i18n files
- `app/src/components/settings/ConnectAgentPanel.tsx`, `app/e2e/specs/board/subtask-reparent.spec.ts`, relevant component/service tests
- `CLAUDE.md`, `DESIGN.md`, and the five referenced spec directories, updated only when their contracts or ownership change

New focused modules: document contracts/schema, document/reference migrations, thin document routes and read/write services, shared detail controller/host, detail header/properties/comments sections, editor setup, task-reference node, task-only tree, document API/hooks, card subtask preview/row, pure progress calculation/display, document/comment MCP tools, task batch/claim services, and import parser/preview/apply/export modules. Each has focused tests; every handwritten file stays under 420 lines. No separate Notes page is required.

Additional PR #460 integration points: `api/src/middleware/requestContext.ts` (extract the context store without changing middleware behavior), `api/src/services/task/{move,moveDestination,format}.ts`, `api/src/utils/taskValidation.ts`, `api/src/services/collaborationService.ts`, `app/src/api/transport.ts`, `app/src/utils/dailySections.ts`, `app/src/hooks/useDailySync.ts`, `app/src/components/AppShell.tsx`, and existing test setup/build configuration. Inspect exact callers before touching them.

Proposed focused foundation modules: `shared/contracts/` (wire types only), `api/src/context/` (actor/source context), `api/src/services/mutation/` (transaction orchestration), `app/src/api/queryKeys.ts`, `app/src/utils/taskMapper.ts`, task mutation/reconciliation hooks, and reusable fixtures under `api/src/test/` and `app/src/test/`. Reuse equivalent modules if the untangle work lands first; do not create duplicate owners. Names are proposed, not claims that these APIs exist.

**Review slices:** extraction/characterization; contracts and mutation delivery; shared task reconciliation; note persistence; editor; embedded tasks; progress; MCP/claims/comments; import/export; confirmed pilot cutover. Keep these independently reviewable and tested. Split a slice further when it mixes unrelated concerns; do not submit one full-feature megadiff.

## Explicitly not in the first release

Notion-style arbitrary databases, formulas, attachments, simultaneous collaborative text editing/CRDTs, a dedicated Notes workspace or note-filtered board, a built-in AI chat or agent runner, automated GitHub synchronization, universal agent plugins, complete settings redesign, guest storage implementation, billing, and production infrastructure migration. None is a prerequisite for managing development through parent-task cards with rich plans.
