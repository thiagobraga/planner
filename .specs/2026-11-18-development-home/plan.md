# BulletPlanner development home

## Context

Development work lives in three places: BulletPlanner ideas, `.specs/` files, and GitHub issues/PRs. Each becomes a competing backlog, so priorities and progress are hard to trust. The goal is not to rebuild Notion before using Planner. It is to write, decide, and follow development work in one calm place.

Decisions: **development home first**. A development plan is a real parent task/card whose rich description holds the plan text and embedded real subtasks. Standalone notes stay available, including capture in Daily and Inbox. Clicking a task or note opens one shared right-side detail panel. Where this plan and the verified facts below differ, the verified facts win.

## Primary goal

Capture tasks and notes in Daily or Inbox, organize development work as Kanban parent tasks, and open any item to write or read its full plan. Embedded subtasks, card previews, the task-only view, progress, and agent updates all operate on the same task records.

**First usable release:** collections split view (tree left, selected collection right), task/note detail panel, rich descriptions, parent cards with five-subtask previews, full-content and task-only views, live progress, agent tools, and a verified pilot import. Not required: guest mode, a separate Notes workspace, or a settings redesign.

## Ownership and working rules

| Information                                      | Authority                             | Other locations                                |
| ------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| Ideas, decisions, plans, priorities, work status | BulletPlanner                         | Read-only exports when needed                  |
| Code, tests, contracts tied to a revision        | Git                                   | Linked from notes/tasks                        |
| Review, CI, merge, releases                      | GitHub                                | Links and updates in Planner                   |
| External bug reports                             | GitHub issue thread                   | One linked Planner task when accepted for work |
| Architecture/design rules                        | `CLAUDE.md`, `DESIGN.md`, source docs | Referenced, not migrated as task lists         |

- One ongoing development collection (`bulletplanner.org`, `5a0f4e37-e825-49b0-8844-30e0acbc9510`), not one per agent session. One parent task per initiative: its description owns the plan, descendants own actionable work, comments hold progress and evidence. Standalone notes are for writing that is not completable work.
- Board states: Backlog, Ready, Doing, Review, Done. Use existing statuses, not a second agent-status system. One main initiative in Doing; safety fixes are explicit exceptions.
- An open PR is not completion. Move work to Review; completion needs its acceptance criteria and applicable merge/deploy checks.
- Link GitHub work; no bidirectional sync and no duplication of GitHub events.
- After cutover, agents read and update the canonical parent task, document, and subtasks. A local snapshot records task ID, document revision, source link, and export time, and is never silently written back. If Planner is unavailable, snapshots are read-only; reconcile explicitly on reconnect and never create another backlog.

## Engineering constraints and PR #460 alignment

PR #460 (`docs(specs): add untangle-codebase analysis`, commit `f24f1b0d`) holds analysis and a skill, not fixes. Its findings are rechecked against the implementation branch. Do not merge it or run its whole-codebase refactor skill.

- **File limit: 419 lines maximum** for every new or modified handwritten source, test, and doc file. Aim for 200-300. Generated files, lockfiles, snapshots, and historical migrations are exempt; new migrations stay small. Check counts before and after edits.
- Split oversized touched files by responsibility before adding behavior: `taskService.ts` (~484 lines), `CollectionsPage.tsx` (~520), and larger board/controller files. No reformatting or minifying to pass the limit, and no single oversized test file.
- One concern per module, explicit inputs and outputs, no hidden global coordination, no circular imports, no giant controllers, no barrels that hide coupling. Types live in dedicated type/contract files.
- Separate behavior-preserving extraction from feature changes. Remove dead code and tests only after confirming callers and replacement coverage.
- **Tests first for every behavior change**: failing regression or acceptance test, implement, green, then refactor. Test cleanup does not come first and does not justify deleting the safety net.

| PR finding | Applied boundary | Scope guard |
| --- | --- | --- |
| F1: divergent task caches, mappers, sync, optimistic writes | One task mapping/query-key module and mutation/reconciliation layer. React Query owns server data; drafts and selection stay separate. No fourth task cache. | Adopt incrementally on touched paths. Do not merge all list pages before notes ship. |
| F2: inconsistent transaction/activity/sync ownership | Small transaction runner: commit/rollback, activity inside the transaction, events published after commit. Actor context from a plain context module, not middleware imports. | Apply to note/task/embed/batch/claim/comment paths here, not every service at once. |
| F3: structural changes and route-only validation | Shared service validation and one structural move path for REST, MCP, and imports. | Never implement reparenting or collection moves inside note or MCP tools. |
| F10: duplicated contracts | One dependency-free shared contract source for `SyncEvent` and new document/reference types. | Do not move unrelated password, palette, or credential contracts. |
| F6/F7: shortcut collisions, unordered preferences | Editor keys respect focus and `defaultPrevented`. Global preferences use the existing preferences path. | No separate preference writer, localStorage fallback, or settings/command-registry rewrite. |
| F4/F8: dates, revoked access | Imported dates stay ISO days; test on real PostgreSQL and non-UTC zones. Revoked collaborators must stop receiving note/task socket payloads before shared notes ship. | Fix demonstrated blockers in focused slices; credential consolidation and rate limits stay separate. |
| Sections 2 and 4: dead surfaces, weak tests | Test live routes and components with real DB/Redis fixtures, real middleware, shared builders, observable behavior. | Do not revive `TaskDetail`/`taskStore` or copy a sync handler into its own test. No blanket deletion based only on the report. |

## Verified starting point

- `parent_task_id` exists (`api/src/types/task.ts:19`); `CreateTaskInput` has `parentTaskId` and `type: 'task' | 'note' | 'event'` (`:42-58`). Reuse these; the obsolete proposed `parent_id` schema is dropped.
- Nesting exists to depth 5 (`api/src/services/task/validation.ts:4`, `app/src/utils/taskTree.ts:12`). Preserve hierarchy and completion semantics.
- Focused task modules already exist (`access`, `move`, `validation`, `events`, `completion`). The agent spec's 1975-line service observation is obsolete.
- Tasks and notes share the `tasks` table, distinguished by `type`. `description` is plain text, rendered whole by `BoardCard.tsx:82` (clamped to 2 lines via `boards.css:189-197`). Attach one optional rich document to either kind; no second note entity.
- `TaskItem.tsx:222`: plain click only selects; double-click renames (`:252`). `BoardCard.tsx:28` has no open action. `BoardCardChecklist.tsx` renders every child with no cap. Characterize these with tests before changing them.
- No Tiptap, Lexical, or ProseMirror dependency in `app/package.json`.
- `TaskDetail.tsx:28` (textarea, local-only comments/subtasks) and `stores/taskStore.ts` have no production importers. Do not wire into them. `CollectionTreeNav.tsx` has no importer.
- MCP registration: `api/src/mcp/server.ts:21-31`, write gate `:28`. `api/src/mcp/tools/collections.ts:9` only lists collections and labels. The existing `notes` tool refers to task descriptions, not standalone documents.
- Reuse `recordActivity()` (`api/src/services/activityService.ts:44`) and `publishEvent()`/`buildEvent()` (`syncService.ts:105,120`) inside the new mutation runner. Existing wrappers in `services/task/events.ts:6` fire and forget; do not copy that.
- `commentService.ts` has no activity or sync calls, though `'comment'` is a `SyncEntityType`. Include it in the transaction/activity/sync work.
- `useCollectionTasks.ts:51` takes page-local arrays and setters. `stores/optimistic.ts` is not the unified cache proposed by F1.
- No lazy chunk exists; the detail panel and editor become the first. Measure main bundle before and after.
- Search uses `ILIKE` on title/description; documents are searched through the derived plain-text `description`.
- Next migration number is **053**. `api/src/db/migrate.ts` runs each file in its own transaction, forward only. Prod migrates the next color before the switch and the rollback trap never reverts the DB, so every migration is additive and the old color must run on the new schema.
- No `shared/` package (Dockerfiles copy one package; `api/tsconfig.json` has `rootDir: "src"`). Instead, byte-identical type-only files at `api/src/contracts/*.ts` and `app/src/contracts/*.ts`, checked by `scripts/check-contracts.sh` in pre-push and `2a.quality.yml`.
- `api/src/index.ts:235` exports the real app; reuse it, extracting an app factory only if startup side effects block isolated tests. `api/src/test/fixtures.ts` from the PR does not exist yet.
- Existing performance PRs #436 (ready), #437, #438 (draft). Do not recreate them or infer completion from spec checkboxes.
- Collections view ignores some remote `task`/`section` events (`CollectionsPage.tsx:67-76`).
- Production collection contents and readiness are not inspected yet. Inventory and dedupe before import.

## Product behavior

### Capture anywhere, organize when ready

- Daily and Inbox accept quick tasks and notes. Writing never requires a plan, a Notes page, or a collection. Existing date and Inbox rules stay.
- Any task can grow into a plan by adding a rich description and subtasks. Standalone notes use the same editor and panel, without completion controls or required dates.
- A migrated initiative is a normal parent task. `plan.md` becomes its description, not a separate note.

### One right-side detail panel

- Plain click or tap on a noninteractive row or card opens details on the right without completing the item or leaving the view. Clicking a subtask title opens that subtask, with a parent breadcrumb.
- Completion controls only complete or reopen. Menus, links, date controls, text selection, and drag never open details; drag-end pointer events never open. Ctrl/Cmd-click keeps multi-select without opening.
- Keep fast inline creation and explicit inline rename (Shift+Enter or context action) and double-click rename, without losing drafts or stealing editor focus. Add an accessible Open details action instead of silently repurposing Enter.
- Desktop: one nonmodal docked panel, about 480px wide; the board stays usable. In the collections split view it is a third pane from about 1280px, and an overlay sheet below. Sticky header: title, close, parent breadcrumb when relevant, completion for tasks only. Body: compact properties, description and subtasks, then comments and activity. Use existing date, status, and label controls; secondary metadata stays collapsed.
- 390px and narrow: a full-width sheet, not a squeezed sidebar. Closing returns focus to the originating item. The mobile sheet contains focus; desktop does not trap it. Escape closes the top overlay first and respects unsaved changes.
- One detail controller in the app shell, keyed by item ID. It stores open state and selection, not a task cache. Loading, missing, deleted, and permission-denied states are explicit.
- **Full content** is the default; an **Only tasks** toggle switches presentation. Full content keeps prose, headings, code, links, and embedded tasks in place. Only tasks shows the full canonical descendant tree for tasks, and a note's linked tasks. The toggle never changes the saved document, hierarchy, or completion.
- Tasks created outside the description still appear in Only tasks and in a compact "Other subtasks" section in Full content. Switching modes or items keeps unsaved drafts and asks before discarding failed saves.

### Rich descriptions with real subtasks

- Tasks and notes share one versioned rich body. Formatting uses selection controls and a small insert menu, with keyboard equivalents. Keep journal styling and 24px rhythm. No database-builder controls.
- Creating a task block inside a description creates a real child through `parentTaskId` in the same collection, and inserts its stable reference at the caret. Nested checklists map to real parent/child relationships within the depth limit. Headings and ordinary bullets are not tasks.
- An embedded block stores block ID and task ID, never copies of title or completion. Text, checkboxes, card previews, and agents all act on canonical tasks.
- Attaching an existing task as a subtask is an explicit reparent through the existing move service, shown before applying. A reference never silently moves someone else's work. Reject cycles, self-links, cross-collection attachments, and depth overflow.
- In a note, a task block is a reference, not ownership. A task created there belongs to the same collection but is not a child of the note. References do not count toward another plan's progress.
- Moving a block changes placement, not parentage or board order. Removing a block unlinks it; the child stays visible under Other subtasks and Only tasks. Deleting a task is a separate confirmed action. Reparenting elsewhere turns the old block into a reference-only link that leaves the former parent's preview and progress.
- Deleting a note keeps referenced tasks. Deleting a parent task must disclose the existing descendant cascade and count. No description edit or note conversion may trigger it. Completing a parent keeps existing cascade behavior with clear UI. Completing the last subtask does not auto-close the parent or skip Review.
- Markdown checkbox conversion runs at explicit import or insertion, never by reparsing prose on each save. Nested work is not duplicated into a second checklist store.
- Show saving, saved, and error states. Writes use document revisions; a remote update never overwrites a dirty draft. Account content is never persisted to localStorage. A failed save keeps the in-memory draft and offers a download, and the UI warns before leaving. Do not claim offline crash-proof persistence.

### Compact parent cards and progress

- A parent card shows title, compact metadata, a short plain-text excerpt, progress, and at most **five direct subtasks** in canonical order. Child counts show deeper nesting. The five-row cap is a display limit, not a data or nesting limit.
- More than five children: **Show all N subtasks** opens the parent's panel in Only tasks. Exactly five shows no link. Child checkbox affects only that child; child title opens that child without bubbling to the parent.
- Drag/drop and the full subtree stay intact when rows are hidden. Preview slicing never truncates moves, progress, export, or API data. Keep existing completed-item visibility and make counts unambiguous.
- Progress counts unique actionable leaf descendants, excluding the parent, notes and events, and reference-only links. Empty plan shows "No subtasks", not 100%. The count, thin moss bar, and "N of M" label share one accessible source. The presentation choice is stored on the document, not in task status.
- Visual decisions (STOP 1): progress shows a thin moss bar plus "N of M". Task rows in task content and Only tasks: 28px min-height, 8px gap, 12px square checkbox. Tasks use a square checkbox (3px radius) everywhere, including card titles and the panel header, centered on the title's first line.
- No note-filtered board this release. Parent-task cards are the development board; notes keep their current behavior.

## Phase 0: Reconcile scope and safe foundations

Prevents rebuilding shipped features or migrating stale plans.

- [ ] Read current source, the five referenced specs, affected callers, and worktree/PR status before editing. Preserve uncommitted main-tree work.
- [ ] Reconcile PR #460 findings with the branch; take only the boundaries above. Adopt any landed implementation instead of a parallel helper.
- [x] Record the 419-line rule in the feature spec and project `CLAUDE.md`. Add a changed-file line-count check to the existing validation entry point, with tests at 419/420 lines, terminal newlines, and explicit generated-file exemptions. Baseline untouched oversized files; do not split the whole repo.
- [x] Build shared test builders and real DB/Redis fixtures before extraction. Reuse existing integration setup.
- [~] Ship foundations as separate slices: (a) characterize and extract touched oversized modules, (b) shared contracts and transaction/activity/event ownership, (c) shared task mapping, query keys, and reconciliation. Each passes regression tests before feature work builds on it.
- [ ] Inspect the target collection through an authorized connection or user export. Do not scrape credentials or create tokens automatically. Compare existing items with spec candidates.
- [ ] Map each initiative to one canonical parent task and its existing PR/task links. Mark requirements implemented, pending, uncertain, or superseded from evidence. Do not turn every historical checkbox into new work.
- [~] Work each slice in `.worktrees/<slug>` on a semantic branch from fresh `main`, with its own deps and stack (`COMPOSE_PROJECT_NAME`, subdomain, hooks per `CLAUDE.md`), draft PR, and certificate step.
- [ ] Verify migration numbers and actual note, export/delete, authorization, search, and board behavior. Never reuse the agent spec's hard-coded migration number.
- [ ] Confirm panel design against `DESIGN.md` (flat tint and 1px border, Lora, 24px rhythm, accent at most 10%, inline panel before any modal). Mocks approved at STOP 1 (see Decisions); add them to `DESIGN.md` and the styleguide.
- [ ] Use the open-source Tiptap editor (`useEditor`, `EditorContent`, `StarterKit`; `Node.create`, `addNodeView`, `ReactNodeViewRenderer`, `NodeViewWrapper`; `editor.getJSON()` for output). Pin compatible versions after checking docs and licenses. No custom contenteditable or hosted document service.

**Verify:** source-of-truth mapping, isolated baseline checks, list of unknowns. No production writes.

## Phase 1A: Collections split view (ships first)

Lets the user move between initiatives in one click while the tree stays put, giving the plan board and panel a stable home.

Today `/collections` (`CollectionsIndexPage.tsx`, 361 lines) lists the tree, and each row calls `navigate('/collection/:id')` (`:39`), replacing the page. `/collection/:id` (`App.tsx:69-70`, `CollectionsPage.tsx`, 520 lines) is separate.

- [x] **Behavior.** `/collections` looks as today: "Coleções" tree on the left with the same rows, colors, rename, create, delete, and menus. The right pane shows an empty state with a New collection action; nothing auto-selects. A row click loads the collection on the right (breadcrumb, View menu, quick add, list or columns as today) and pushes `/collection/:id`, so back and forward move the selection. Selected row: `aria-current="page"`, bold.
- [x] **No remount on selection.** Tree scroll, open menus, in-progress rename, and expansion survive. Rows are real links: Ctrl/Cmd/middle-click opens a new tab; plain click on the selected row does nothing. Deep links, search results, breadcrumbs (`CollectionBreadcrumbs.tsx:68`), and the top-bar highlight (`TopBarItem.tsx:13`) render the same split view.
- [x] **Layout.** Tree pane fixed at 264px (11 baseline units); content flexible, 480px minimum; flat tint, 1px border, no shadows. With the panel open: three panes from about 1280px, overlay sheet below. Below 768px keep today's single-pane flow (`/collections` full-width list; `/collection/:id` full-width with a way back). Mobile must not change.
- [x] **Structure.** Add a `CollectionsLayout` route element rendering the tree pane and an `<Outlet />`. Extract the tree from `CollectionsIndexPage.tsx` into focused modules (rows, row menu, create/rename/delete handlers, tree hook) reusing `buildCollectionTree` and `['collections']`; no second cache. Split `CollectionsPage.tsx` first in behavior-preserving commits under characterization tests. Key content by collection ID so local state resets on selection. Do not revive `CollectionTreeNav.tsx`; delete it in a separate commit.
- [x] **Edge states.** Unknown ID or no access: "Collection not found", no name leak. Deleting or archiving the open collection returns to the empty state (`CollectionsIndexPage.tsx:265`). Rename and recolor update tree and header from one query. Remote task, section, and collection changes refresh the open collection.
- [x] **Accessibility.** Tree rows keyboard-focusable; focus stays on the clicked row; the right pane is a labelled region with a heading; loading is announced politely; no focus theft from rename or quick add.
- [ ] **Out of scope:** collapsible or resizable tree, favorites in the tree, new drag targets, arrow-key tree navigation.

**Verify:** reference layout at desktop; six collection clicks never remount the tree; narrow view unchanged; one collection fetch per selection. Tests: characterize rows and page first; then route matrix, `aria-current`, no-remount (scroll and open rename survive), back/forward, deep link, 390px, delete open collection, live API change. Existing `topBarNav`, `collectionsPageSubtitle`, `kanbanListAddTask` e2e specs must pass.

## Phase 1B: Toolbar buttons look the same (UI slice)

The toolbar sits above every board and the panel; one control family keeps it scannable.

Today `Hoje`, previous, next, and the range picker are secondary xs `Button`s (`DateNav.tsx:74-95`, 20px high, 11px). `Visualizar`, `Janela`, and `Group: X` are borderless 14px text triggers (`MenuButton.tsx:68`, `.page-menu-trigger` in `styles/toolbar.css:31`). Range pickers render bold (`DateNav.tsx:88`, `WeekSelector.tsx:95`).

- [x] **Menu triggers become small buttons.** `Visualizar`, `Janela`, and `Group: X` (via `MenuButton`, used by `ViewMenu`, `WindowMenu`, `GroupByMenu`) match `Hoje`: height, padding, radius, border, hover/active/focus, 11px text, 12px chevron. Reuse `Button` if it can carry the ref and ARIA wiring; otherwise export its class tokens from `ui/Button.tsx`. Keep `aria-haspopup`, `aria-expanded`, `aria-controls`, the open state, and keyboard behavior.
- [x] **Every page-toolbar select matches.** Inventory triggers in `.page-toolbar` and the phone bar (Daily, Habits, Inbox, Collections, Group by). Menu panels and items do not change. `CustomSelect` in settings is out of scope.
- [x] **No bold range pickers.** Remove `font-semibold` from `DateNav.tsx:88` and `WeekSelector.tsx:95`. Keep tracking, uppercase, and fixed widths; keep the today marker in the popovers (`DateNav.tsx:134`, `WeekSelector.tsx:158`). Confirm widths fit at desktop and 390px.
- [x] **Fit and touch.** Shedding order: compact date, then Today, then Window folds into View. On phones keep a 44px hit area via `@media (pointer: coarse)` without changing the look. Check 1280, 1024, 768, and 390px for wrap or overflow.
- [x] **Docs.** Update `DESIGN.md:333` (View and Window are small secondary buttons matching Today) and the Styleguide. Delete `.page-menu-trigger*` rules after confirming no other user.
- [x] **Tests first.** `toolbar.test.tsx`: every trigger has shared button styling and ARIA state; no range trigger has bold weight; menus open, close, and navigate by keyboard. Keep `.date-nav-trigger` working for the `weekSelector`, `dailyAccessibility`, and `habitsToolbar` specs. Before/after screenshots at desktop and 390px in `app/dist/screenshots/`.

**Verify:** one control family; no bold range label; menus unchanged; no layout regression on `PageToolbar` pages.

## Phase 1: Shared detail panel and durable rich descriptions

Lets the user open any task or note from the current view and write its full plan.

- [x] Write failing tests first: open/close, gesture isolation, persistence, permissions, conflicts, editor. Characterize row selection, inline editing, shortcuts, and card drag before changing click handling.
- [x] Add a document table keyed to existing task/note IDs, not limited to `type='note'`: versioned JSON, schema version, revision, timestamps. Title, collection, parent, dates, and status stay on the task. One authoritative body per entry.
- [x] Focused document read/write services and thin routes: collection authorization, compare-and-swap revision checks, safe URL and node validation, bounded size and depth. Wire types go in the shared contracts.
- [x] Seed existing plain descriptions losslessly on first rich edit; title stays separate. Once a document exists, `description` is a derived plain-text summary, not a second editable source. Legacy REST/MCP description writes must not silently replace rich content; return a clear revision-aware error. Test this boundary.
- [x] Record activity through the transaction runner and publish after commit. Return the committed result. A publish failure must not look like a rollback or make retries duplicate writes. Central reconciliation refreshes queries without replacing dirty drafts.
- [~] One lazy-loaded panel host and controller in `AppShell`, opened from Daily, Inbox, collection rows, board cards, and subtask rows. Rich editor code stays out of the initial Daily bundle.
- [~] Focused header, properties, document, and comments/activity components. Do not revive `TaskDetail`.
- [~] Desktop dock and mobile sheet; focus restoration; close and Escape; parent breadcrumb; loading, deleted, and denied states; dirty-draft protection on item switch. Keep inline editing and multi-select.
- [ ] Include document bodies in authorized search and account export, restore, and delete. Export lossless JSON and readable Markdown. Audit task/note type conversion and parent deletion so an incidental edit cannot remove documents or descendants.

**Verify:** both kinds in Daily and Inbox; click opens without completion; checkbox, menu, and drag do not open; keyboard, multi-select, and inline rename still work; full descriptions survive create, edit, reload, and export; two-tab conflicts keep drafts; mobile close returns to the row; unauthorized data never appears.

## Phase 2: Embedded subtasks, five-row cards, task-only view

Makes each Kanban plan one consistent subtree across prose, card preview, and details.

- [ ] `taskReference` editor node and a reference index derived from validated content. Parentage stays only in `parentTaskId`; text placement is not a second hierarchy.
- [ ] Atomic create-and-embed: a task owner creates a child; a note owner creates a standalone reference. Task, reference, and document revision commit together under an idempotent operation ID.
- [ ] Extract transaction-capable task creation before extending `taskService.ts`. Reuse validation, access, move, activity, and event boundaries. Attaching an existing child uses the explicit structural operation; reject cycles, depth overflow, and collection mismatch.
- [ ] Resolve references and the full descendant tree in bounded batch queries. Share mapping, cache, and reconciliation with list and board surfaces; no copied arrays, per-block fetches, or `taskStore`.
- [ ] Full content and Only tasks are projections of the same data. Non-embedded descendants appear as Other subtasks. Toggling keeps drafts and hierarchy; completion and open-child actions work in both.
- [ ] Split `BoardCardChecklist` into preview and row components. Show the first five direct children, plus Show all N opening the parent's Only tasks view. Drag/drop and progress use the full subtree.
- [ ] Bounded plain-text excerpt for the card. One pure unique-leaf progress function and one presentation component for the thin moss bar and "N of M" label.
- [ ] Protect unlink, task deletion, note deletion, parent cascade confirmation, reparented references, and copy/paste identity. Cross-collection moves reject unresolved references or reconcile them inside the same authorized operation.
- [x] Replace timeout-driven rollback on adopted paths with outcome-aware rollback that cannot overwrite newer successful edits. Never treat synthetic offline responses as committed revisions. Test delayed success, true failure, concurrent writes, and reconnect.

**Verify:** zero, five, and six children; hidden children still counted and moved; Show all reaches everything; Full content and Only tasks lose nothing; parent and child clicks hit the right item; panel, board, and agent updates converge; unlink keeps subtasks; note deletion differs from parent deletion; failed or retried creation is atomic.

## Phase 3: Agent workflow and pilot migration

Lets agents use the plans people see, and retires duplicate tracking for a small verified set.

- [ ] MCP read tools for document content and revision, task detail and descendants, comments, activity. Write tools for block edits, child creation, statuses, comments. REST, MCP, and imports share one validation, access, and mutation path. Comment activity and sync live in the service, not the adapter. Structural edits use the canonical move path. Text-only description writes cannot bypass document revision protection.
- [ ] Document edits address stable block IDs and an expected revision; agents never replace content fetched before a newer human edit. Agent-created subtasks appear in the parent's card and Only tasks view, placed in prose or not.
- [ ] Bounded, transaction-safe, idempotent batch creation using Phase 2 helpers. The server stores request identity and payload hash; same key with changed payload is a conflict, never an overwrite.
- [ ] Atomic claim and release for parallel agents. Actor identity comes from the authenticated token or grant, never a caller label. Claims expire with explicit recovery, so a crashed agent cannot lock a task. Claims coordinate work; they grant no access.
- [x] Show actor, claim, comments, and result links in active UI. Extend the existing Integrations setup without waiting for the settings redesign.
- [x] Document the client workflow: read the parent plan, claim a Ready subtask, set status, comment evidence and PR link, release the claim, move to Review. No mirrored private todo lists, no collection per session.
- [ ] Bounded Markdown import with dry-run preview. One spec folder becomes one parent card, with `plan.md` as its rich description. If `task.md` exists, keep its text under a named section in the same description. Preserve headings, code, links, prose, and original bytes. Unsupported constructs produce warnings, never silent loss.
- [ ] Convert selected checklist items to real descendants, embedded at their original positions. Preserve `[x]` and `[~]` through mapped completion and status. Headings and ordinary lists stay prose. Dedupe overlapping checklists through reviewed mappings, not title guesses. Flag nesting beyond the depth limit for review.
- [ ] Import manifest keyed by user, source path, source hash, and item mapping. Exact retries return prior results; changed input needs a preview and reconciliation, never a blind import or overwrite.
- [ ] Pilot the agent-tool and guest-mode specs after deduplicating against existing items. Reconcile the agent spec's obsolete hierarchy and service assumptions first. Import launch and settings plans only after the pilot verifies.
- [ ] Before any real import, produce a dry-run report: destination, cards, subtasks, and documents to create or link, sensitive-content warnings, expected counts. Interactive runs show it for confirmation; the unattended run uses the assertion gate below. Originals stay untouched. Verify backups and restores before treating production plans as authoritative.
- [ ] Every real import writes a manifest and ships an undo that removes exactly what the manifest created, only where an item is unmodified. Modified items are reported, never deleted.
- [ ] Cut over each pilot after content, status, reference, and export round-trip comparison. Mark the original superseded with the canonical link and revision; keep it in Git history. Never delete `.specs` wholesale.
- [ ] After cutover only: update `CLAUDE.md` so Planner holds plans and progress, and the repo holds implementation artifacts and generated snapshots. Edit the real file, not its symlinks.

**Verify:** a real authorized MCP client reads a plan, creates a task once despite retries, claims it, comments progress, and updates the browser live. Two claimants yield one winner. Stale note edits conflict. Read-only credentials cannot write. Revoked credentials fail. Repeated imports create nothing new and never overwrite user edits.

## Test contract

Tests ship with each slice, not as a final project. Each test file stays under 419 lines, split by behavior.

| Layer | Required coverage | Boundary |
| --- | --- | --- |
| Pure unit | Document schema, reference extraction, unique-leaf progress, checkbox and status mapping, deterministic export, shared task mapper, line-count check | Typed fixtures and deterministic clocks; assert outputs, not call order. |
| Service integration | Revision conflicts, legacy description guard, attach cycles and depth, atomic create-and-embed, batch rollback and idempotency, claim races and expiry, comment attribution, move invariants, cross-account and collaborator permissions | Real PostgreSQL and Redis, isolated data, cleanup. No scripted SQL replies or mock DB/Redis success paths. |
| Mutation delivery | Activity rolls back with writes; failed transactions emit nothing; successful ones emit the intended events; post-commit publish failure is not a rollback | Real runner and services; narrow outage injection allowed. Assert stored data and observed socket or pubsub behavior, not copied handler logic. |
| REST and MCP | Equivalent validation, scopes, auth and CSRF, revision errors, invalid parents and sections, revoked credentials, actor propagation | Real app middleware and a real MCP client. No forced `req.userId`, fake app, or route-calls-service-only tests. |
| Frontend | Row, card, and child open targets; checkbox, menu, drag isolation; multi-select and rename; 0/5/6-child previews; mode switch keeps draft and hierarchy; save and conflict recovery; delayed-write protection; panel, list, board sync | Shared provider, router, React Query harness, and task builders. Mock only transport and socket boundaries. |
| Playwright | Capture tasks and notes in Daily and Inbox; desktop panel and mobile sheet; import a parent with prose and subtasks; Show all opens task-only; agent changes appear live; two-user isolation and live revocation | Real stack; role and name selectors; condition-based waits, no sleeps. |

Preserve existing tests during extraction. Replace SQL-string assertions, class-order checks, tautological tests, and tests of copied handlers only within touched scope, after replacement coverage is green. Await all async work; no unhandled promises or `act()` warnings. Each PR states tests run, failures, and unverified behavior.

## Execution protocol

You said this runs in one shot, including deploys. That authorizes only what is listed here. Production path (`.github/workflows`): merge to `main` runs CI (`2a` quality, `2b` security); `3.release.yml` opens a release-please PR; merging it creates the tag and runs `4.deploy.yml` (build, scan, `scripts/blue-green-deploy.sh` over SSH in `production`: migrate job, health checks, automatic rollback trap, previous image in `deploy/.previous-image`). `main` has no branch protection, so these gates are the safety net.

**Authorized:** worktrees and semantic branches; small Conventional Commits with the `Co-Authored-By` trailer; pushing own branches; draft then ready PRs; merging this plan's own PRs after green CI; merging the release-please PR; watching the deploy and public health check. **Not authorized:** merging or editing others' PRs (#433, #435-#438, #460) or rebasing onto unmerged ones; force-push; `--no-verify`; changing branch rules, secrets, workflow permissions, or infrastructure; deleting or rewriting production data; touching uncommitted work in the main checkout (work stays in worktrees; never stash or checkout there).

**Gate before every merge:** failing test first, then green; lint, type check, both builds; line-count check; desktop and 390px browser check with screenshots in `app/dist/screenshots/`; all PR checks green. Fix root causes. Never weaken or skip a test.

**Deploy rules.** Merging to `main` does not deploy; the release PR does. Deploy after slices 3 and 3b together (UI only, one release). Deploy each schema slice alone so a rollback maps to one change. Migrations are additive and backward-compatible (new tables or nullable columns; no renames or drops). Before any deploy with a migration, take a `pg_dump` and test-restore it into a scratch database (off-server backups are not automatic). If that cannot run unattended, merge the slice, hold its release PR, and stop. After each deploy confirm the public router returns 200 for the app and `/api/v1/health`, the version matches, and note the rollback command. Never retry a failed deploy blindly: let the script roll back, record logs, stop.

**Production import gate.** Import only through the app's API, using a token the user created in Settings > Integrations and placed in the environment. Never create or scrape a token. Proceed only when the dry-run counts match exactly, there are zero ambiguous matches, sources are read-only, and manifest and undo are verified on a scratch database first. Otherwise skip those items, keep the report, and continue elsewhere.

**Stop and report (do not push through):** same CI failure after two root-cause attempts; a test that would need weakening; high or critical security finding in new code; non-additive migration; failed or unverifiable backup; production health failure; any action not listed as authorized; low disk or broken local stack. Unblocked work continues.

**Run log:** the Execution log section below, updated per slice (branch, PR, commit, CI, deploy run, screenshots, unverified items, stop reason). Final summary: shipped, deployed, held, unverified. Never claim a check passed that was not run.

## Phase 4: Daily-use validation and cutover readiness

Proves the app reduces tracking work before migrating more or adding features. Unit, integration, and gate checks are covered above; this phase adds:

- [ ] Shared task suite across Daily, Inbox, Collections, notes, and boards. Remote task, section, status, and label changes reconcile without refetch storms. Editor keystrokes never trigger global page shortcuts.
- [x] Browser golden path: capture a task and a note in Daily and Inbox; open each in details; write a parent plan with at least six subtasks among paragraphs; check the five-row preview; Show all opens the task-only tree; switch back without losing prose; receive an agent update; export, reload, and check another tab. Covered by `app/e2e/developmentGoldenPath.spec.ts` (#517 and follow-up); it found and fixed two bugs: typing after Add task replaced the new block, and panel changes never reached the board behind it.
- [~] Edge cases: subtask title does not open its parent; inline rename, multi-select, and shortcuts still work; focus restoration on desktop and mobile; failed save while closing or switching; stale revision; deleted or moved task; parent cascade confirmation; revoked access; empty plan; duplicate references; import failure and retry; `[~]`; unsafe URLs and HTML; long documents. Unit and integration tests cover stale revision, cascade, revoked access, duplicate references, unsafe URLs, `[~]` import and deleted items; E2E covers subtask rows opening the subtask. Still open: long documents and failed save while switching in the browser.
- [~] Desktop and 390px screenshots under `app/dist/screenshots/`, linked. Check keyboard, focus, mobile typing, console errors, and unchanged Daily, list, and board behavior. Desktop: `golden-path-plan.png`, `golden-path-board.png`, `detail-agent-claim-desktop.png`; 390px: `detail-agent-claim-390.png`.
- [x] Representative large spec loads without per-task request fan-out or Daily bundle regression. Measure before and after; build success is not proof. 2026-11-20 on `f293b6f1`, guest-mode spec (76 tasks): board 9 requests in 2585 ms, none per task; panel open 2 requests (task, document) in 886 ms. Open: duplicate initial calls (`auth/me`, `version`, `views/collection/:id` twice each) and the Daily bundle comparison. Bundle on `main` after #514: entry chunk 333 KB gzip with no ProseMirror; the editor ships in its own lazy `TaskDetailPanel` chunk (159 KB gzip). The duplicate initial calls come from `React.StrictMode` in dev and do not happen in production builds.
- [ ] Dogfood one real development block from plan through PR review. Success: no duplicate status updates, no lost writing, readable agent activity, a clear Ready task next.
- [ ] Expand migration only after this gate. Keep stacks available for review; no automatic teardown or blanket production migration.

## Relationship to the five existing initiatives

| Initiative          | Treatment |
| ------------------- | --------- |
| Agent task tool     | Revise and absorb the needed subset in Phase 3. Reuse existing nesting and service split; plugin distribution across clients comes later. |
| Go-live performance | Finish and review #436-438 separately. Avoid conflicting editor bundling; coordinate chip-name and bundle changes; measure the lazy editor cost. |
| Settings redesign   | Preserve the Penpot design and its approval gate. Only minimal integration controls here. |
| Guest mode          | Next milestone after the pilot. Keep browser-only, no-anonymous-server-writes guarantees. Align document schema, export, and import contracts; no second storage backend this release. Rich descriptions and the panel must update its plain-text rendering assumption when they enter guest scope. |
| Go-live             | Separate safety and launch checklist. Tested backups, security fixes, and recoverability gate canonical storage and public access. Pricing, marketing, billing, and infrastructure migration are out of scope here. |

## Relevant files

- Task model and services: `api/src/types/{task,activity}.ts`, `api/src/services/{taskService,collectionService,commentService,activityService,syncService,searchService}.ts`, `api/src/services/task/{access,validation,events,completion,move,moveDestination,format}.ts`, `api/src/routes/{index,tasks}.ts`, `api/src/db/migrations/`, `api/src/middleware/requestContext.ts`, `api/src/services/collaborationService.ts`, `api/src/utils/taskValidation.ts`
- MCP: `api/src/mcp/server.ts`, `api/src/mcp/tools/{tasks,collections}.ts`, `api/src/mcp/toolkit.ts`, `api/src/mcp/__tests__/server.integration.test.ts`
- Frontend pages and components: `app/src/App.tsx`, `app/src/pages/{CollectionsPage,CollectionsIndexPage}.tsx`, `app/src/components/{AppShell,TaskItem,TaskList}.tsx`, `app/src/components/board/{BoardCard,BoardCardChecklist,CollectionBoard,WeekSelector}.tsx`, `app/src/components/toolbar/{MenuButton,DateNav,ViewMenu,WindowMenu,GroupByMenu}.tsx`, `app/src/components/ui/Button.tsx`, `app/src/components/settings/ConnectAgentPanel.tsx`, `app/src/styles/toolbar.css`
- Frontend state and API: `app/src/api/{client,transport}.ts`, `app/src/hooks/{useSync,useCollectionTasks,useDailySync}.ts`, `app/src/stores/optimistic.ts`, `app/src/utils/{taskTree,dailySections}.ts`, `app/src/types/`
- Tests and CI: `app/e2e/specs/board/subtask-reparent.spec.ts`, `app/e2e/{topBarNav,collectionsPageSubtitle,kanbanListAddTask}.spec.ts`, `.github/workflows/{3.release,4.deploy}.yml`, `scripts/blue-green-deploy.sh`
- Docs updated only when contracts or ownership change: `CLAUDE.md`, `DESIGN.md`, the five referenced spec directories

New modules (proposed, not claims that these exist; reuse equivalents if the untangle work lands first): `api/src/contracts/` and `app/src/contracts/` (wire types), `api/src/context/` (actor context), `api/src/services/mutation/` (transaction runner), `app/src/api/queryKeys.ts`, `app/src/utils/taskMapper.ts`, task mutation and reconciliation hooks, document schema and routes, detail controller and host, panel sections, editor setup, task-reference node, task-only tree, card preview and row, progress calculation, document and comment MCP tools, batch and claim services, import parser, preview, apply, and export. Shared fixtures under `api/src/test/` and `app/src/test/`. Each has focused tests.

Review slices (each independently reviewable): extraction; contracts and mutation delivery; task reconciliation; note persistence; editor; embedded tasks; progress; MCP, claims, comments; import and export; confirmed pilot cutover. Do not submit one full-feature megadiff.

## Explicitly not in the first release

Notion-style databases, formulas, attachments, simultaneous collaborative editing or CRDTs, a dedicated Notes workspace or note board, a built-in AI chat or agent runner, automated GitHub sync, universal agent plugins, a complete settings redesign, guest storage, billing, and production infrastructure migration. None is a prerequisite for managing development through parent-task cards with rich plans.

## Open questions

1. Postgres 16 to 18 maintenance window (STOP 2).

## Execution log

### Slice queue

| # | Slice | Branch | PR | State |
| --- | --- | --- | --- | --- |
| M0.1 | Theme color scales | feat/theme-color-scales | #433 | merged `c1ab013d` |
| M0.1 | Daily chip names | perf/daily-chip-names | #436 | merged |
| M0.1 | Spec, archive finished specs, close #460 | docs/development-home | #461 | merged; #460 closed |
| M0.3 | S-B backup, restore check, rollback | feat/db-backup-restore | #462 | merged |
| M0.4 | S1 line check, contract check, fixtures | chore/line-limits-fixtures | #465 | merged |
| M0.5 | S-MCP parent and status tools | feat/mcp-parent-status | #468 | merged `ee8c9d3d` |
| R0 | Release and verify | - | #469 | v0.27.0 deployed and verified |
| M1.6 | S-H task hierarchy reliability | fix/task-hierarchy | #470 | merged `a8f5bfaf` |
| M1.7 | S2 CollectionsPage split | refactor/collections-page-split | #472 | merged `41b9c072` |
| M1.8 | S3 collections split view | feat/collections-split-view | #474 | merged `b410d769` |
| R1a | Release and verify | - | #475 | v0.28.0 deployed and verified |
| M1.9 | S3b toolbar buttons, Window to Planner menu | style/toolbar-buttons | #476 | merged `cc92c5ee` |
| R1 | Release and verify | - | - | v0.28.1 and v0.28.2 deployed and verified |
| STOP 1 | R1 report, panel and card mock approval | - | - | approved |
| M2.10 | S4 contracts, mutation runner, comment sync | refactor/mutation-runner | #480 | merged `c0f02316` |
| M2.11a | S5a task documents API and data (migration 053), no UI | feat/task-documents-api | #482 | merged `a59019ba` |
| M2.11b | S5b detail panel and Tiptap editor UI | feat/task-detail-panel | #489 | merged `47005d36`; review fixes #491 |
| M3.12 | S6 embedded subtasks, five-row cards | feat/embedded-subtasks | #494 | merged `c24ac845` |
| M4.13 | S7 MCP document, comment, claim, batch | feat/mcp-documents | #495 | merged `35f575e3` |
| M4.14 | S8 Markdown import, dry run, undo | feat/markdown-import | #499 | merged `15ed4926`; status filing #503 |
| - | Document export, delete safety, inbox split | feat/export-documents, test/document-safety, refactor/inbox-page-split | #502, #507, #509 | merged |
| R4 | Release and verify | - | #510 | v0.37.3 deployed, app and API health 200 |
| M4.16 | Panel claim, comment actor and links | feat/panel-agent-claim | #511 | merged |
| M3.17 | Outcome-aware optimistic rollback | fix/optimistic-outcome-rollback | #514 | merged |
| M4.18 | Agent workflow docs in README | docs/agent-workflow | #515 | merged |
| M5.19 | Golden path E2E, two panel fixes | test/development-golden-path | #517 | auto-merge armed |
| M5.20 | Golden path export, second tab, subtask row | test/golden-path-export | - | this PR |
| - | Subtle hover scrollbars | style/subtle-scrollbars | #513 | needs visual check by user (scrollbars cannot be captured here) |
| M4.15 | S9 pilot import and cutover | - | - | blocked: production import needs a user-created API token in the environment; rehearsal on scratch stack passed |
| STOP 2 | Report before Postgres upgrade | - | #506 (draft) | blocked: user picks maintenance window |
| M5.16 | Postgres 16 to 18 | chore/postgres-18 | - | blocked: user confirmation; dump/restore only (PG18 checksums block pg_upgrade), mount `/var/lib/postgresql`, dedicated cutover script (deploy uses `--no-recreate`) |

Slice split: S5a (API and data, `task_documents`, `GET/PUT /tasks/:id/document`, `DOCUMENT_EXISTS` guard) ships before S5b (panel and editor). Account export of documents and recurring-copy of documents belong to S5b or S8.

### Decisions from STOP 1

- Progress: thin moss bar plus "N of M" (body: Compact parent cards and progress).
- Task row and checkbox sizing: body, Compact parent cards and progress.
- Mocks (desktop, 390px panel, six-subtask card): https://claude.ai/artifact/HY12ssBqGWYN4aC1wyQgky

### Tracking

Slices are subtasks of milestone cards M0-M5 in `bulletplanner.org`. A slice card moves to Fazendo when its branch opens and completes when its PR merges.

### Housekeeping done

- Removed merged worktrees and stacks: `core-module-boundaries`, `daily-query-repository`, `dependabot-alerts`, `theme-color-scales`, orphan `planner-antigravity`, `collections-page-split`, `collections-split-view`, `task-hierarchy`, `mcp-parent-status`, plus their ad hoc test containers.
- Archived finished specs to `.specs/completed/`; removed the stale root duplicate of `daily-ux-adjustments`.

### Releases

| Release | Tag | Deploy run | Health | Rollback |
| --- | --- | --- | --- | --- |
| R0 | v0.27.0 | [44392997786](https://github.com/thiagobraga/planner/actions/runs/44392997786) | App and API 200, build `20261118T203858Z`, backup restore check passed | `CORS_ORIGIN=https://planner.thiagobraga.dev bash scripts/blue-green-deploy.sh "$(cat deploy/.previous-image)"` |
| R1a | v0.28.0 | [44510474439](https://github.com/thiagobraga/planner/actions/runs/44510474439) | App 200, API health ok, release published after healthy deploy | same command |
| R1 | v0.28.1 | - | Toolbar shipped, deployed and verified; v0.28.2 also deployed | same command |
| R4 | v0.37.3 | - | App and API health 200 after deploy; S5b through S8 and delete-safety fixes shipped | same command |
