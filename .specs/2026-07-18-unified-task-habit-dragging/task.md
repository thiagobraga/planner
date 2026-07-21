# Unified Task and Habit Press-and-Drag

> Goal: provide persistent press-and-drag movement for tasks, task subtrees, habits, sub-habits, and habit groups across active Planner views, including Daily date moves and sidebar collection drops. Remove row selection and use double-click/double-tap for direct inline editing.

## Locked behavior

- [x] Manual order is authoritative
  - [x] Open and completed tasks may remain interleaved in the exact dropped position
  - [x] Priority and completion state must not override manual order after reload
  - [x] Stable fallback ordering uses `createdAt` only when two stored order values tie
- [x] Task drag supports full tree movement
  - [x] Vertical movement changes sibling position
  - [x] Horizontal movement projects nesting in 24px increments
  - [x] Maximum task depth remains 5
  - [x] Dragging a parent carries its complete descendant block
  - [x] Invalid cycle and descendant drops are rejected without mutating local or server state
- [x] Habit drag supports the existing one-level hierarchy
  - [x] Root habits can move between groups
  - [x] Leaf habits can become sub-habits through horizontal projection
  - [x] Sub-habits can be promoted to roots
  - [x] Sub-habits can be manually reordered under the same parent
  - [x] A habit with children cannot become a sub-habit
  - [x] Dragging a parent habit carries its sub-habits
- [x] Press interaction works on desktop and mobile
  - [x] Pointer drag activates after a 180ms press with 8px movement tolerance
  - [x] Quick scrolling before activation cancels drag instead of blocking page scroll
  - [x] Toggles, inputs, menus, task controls, and habit day cells never initiate pointer drag
  - [x] Keyboard dragging remains available from the accessible drag handle
- [x] Editing is direct
  - [x] Remove task row selection state, selected styling, and single-click selection callbacks
  - [x] A quick single click performs no Planner selection action
  - [x] Double-click/double-tap opens inline editing for tasks, habits, sub-habits, and habit group names
  - [x] Existing keyboard edit, commit, cancel, delete, and add-below behavior remains available

## Phase 0 - Contracts and shared types

- [x] Add shared frontend drag metadata types
  - [x] `TaskDragData` includes task ID, parent ID, collection ID, due date, depth, container ID, and subtree IDs
  - [x] `HabitDragData` distinguishes root habit, sub-habit, and habit group
  - [x] `CollectionDropData` identifies named collections, sub-collections, and Inbox
  - [x] `DayDropData` identifies a rendered Daily ISO date
- [x] Add API client move contracts
  - [x] `TaskMoveInput` contains `parentTaskId`, optional `collectionId`, optional `dueDate`, target ordering scope, and zero-based position
  - [x] Task ordering scope is either `{ kind: 'collection', collectionId }` or `{ kind: 'day', dueDate }`
  - [x] `TaskMoveResponse` returns all affected moved-subtree and reordered-sibling task records
  - [x] `HabitMoveInput` contains `parentId`, `groupId`, and zero-based position
  - [x] `HabitMoveResponse` returns the moved habit and every habit whose order changed
  - [x] `HabitGroupMoveInput` contains a zero-based position
- [x] Preserve existing endpoints for compatibility
  - [x] Keep `PATCH /tasks/:id/reorder` operational but stop using it from the new UI
  - [x] Keep name/property update endpoints separate from structural move endpoints
- [x] Migration 025 IS required, contrary to this spec's original assumption
  - [x] A task holds a position in its collection _and_ an independent one in its
        day; one `order_value` column cannot express both, so day positions live
        in `task_order` (migration 025). Daily ordering could not survive reload
        without it.
  - [x] Reuse task `parent_task_id`, `collection_id`, `due_date`, `depth`, and `order_value`
  - [x] Reuse habit `parent_id`, `group_id`, and `order_value`
  - [x] Reuse habit-group `order_value`

## Phase 1 - Shared drag coordinator

- [x] Add a shell-level Planner drag provider around Sidebar and routed page content
  - [x] Own the single `DndContext` used by collections, tasks, habits, and habit groups
  - [x] Dispatch drag lifecycle events by `active.data.current.kind`
  - [x] Allow the currently mounted page and sidebar to register entity-specific handlers
  - [x] Remove nested `DndContext` instances that prevent cross-sidebar drops
- [x] Add custom sensors
  - [x] Pointer sensor enforces the 180ms/8px press constraint
  - [x] Pointer activator ignores interactive descendants marked as non-draggable
  - [x] Keyboard sensor starts only from the dedicated drag handle so Space continues toggling tasks
  - [x] Preserve sortable keyboard coordinates and screen-reader instructions
- [x] Add type-aware collision detection
  - [x] Task drags consider task rows, Daily containers, collection rows, and Inbox
  - [x] Habit drags consider habit rows/cards and habit-group containers
  - [x] Collection drags consider only collection rows
  - [x] Prefer pointer intersection for container targets and closest-center for sortable rows
- [x] Add shared drag presentation
  - [x] Render `DragOverlay` outside clipped scroll containers
  - [x] Show dragged title and descendant count
  - [x] Show a 1px insertion line at the projected target position
  - [x] Show projected indentation aligned to the 24px page grid
  - [x] Highlight valid day, group, Inbox, and collection drop targets
  - [x] Visually reject invalid targets and announce the reason through an ARIA live region
        (collision detection filters invalid targets so they never light up; the
        drag hooks announce why a drop was refused)
  - [x] Enable vertical auto-scroll while dragging long lists

## Phase 2 - Task move service and endpoint

- [x] Add `PATCH /api/v1/tasks/:id/move`
  - [x] Authenticate before resolving source or target entities
  - [x] Validate body shape, target scope, non-negative integer position, and ISO due date
  - [x] Verify access to the dragged task, target parent, and target collection
  - [x] Reject self-parenting, descendant-parenting cycles, and depth overflow
- [x] Implement the move in one database transaction
  - [x] Lock the dragged task, descendant subtree, source siblings, and target ordering scope
  - [x] Compute the source subtree with a recursive CTE
  - [x] Derive the destination parent, depth, collection, section, date, and sibling position
  - [x] Reassign target order values using gap-based `index * 1000` ordering
  - [x] Normalize source siblings after removal when source and target scopes differ
  - [x] Shift descendant depths by the root depth delta
  - [x] Update every descendant collection and section when crossing collections
  - [x] Update every descendant due date when crossing Daily date containers
  - [x] Preserve descendant parent relationships and relative order
  - [x] Preserve task completion, priority, labels, recurrence, and content fields
  - [x] Commit only after every subtree and ordering update succeeds
- [x] Define destination rules
  - [x] Reordering under a parent uses that parent's sibling scope
  - [x] Reparenting inherits the parent's collection and section
  - [x] Root reordering in Collection/Inbox uses collection scope
  - [x] Root reordering in Daily uses date scope across collections without silently changing collection
  - [x] Sidebar collection or Inbox drop clears the dragged root's external parent, promotes it to depth 0, and appends it
  - [x] Dropping a subtask onto its current collection also promotes it to a top-level appended task
  - [x] Sidebar drops preserve each moved task's due date
  - [x] Daily cross-date drops set the target date on the entire moved subtree
- [x] Return and synchronize affected records
  - [x] Return all moved subtree records and source/target siblings whose order changed
  - [x] Publish an `updated` task sync event containing the root task and affected IDs
  - [x] Ensure other sessions invalidate Inbox, Daily, and Collection task queries
- [x] Add service and route tests
  - [x] Same-parent reorder upward and downward
  - [x] Parent move carries all descendants
  - [x] Reparent shifts descendant depth correctly
  - [x] Cross-collection move updates every descendant collection/section
  - [x] Cross-day move updates every descendant due date
  - [x] Completed task remains completed and retains exact position
  - [x] Sidebar Inbox move
  - [x] Position clamping
  - [x] Inaccessible collection/parent rejection
  - [x] Cycle and maximum-depth rejection
  - [x] Transaction rollback leaves the original tree and order untouched

## Phase 3 - Tree-aware task projection

- [x] Extend `app/src/utils/taskTree.ts`
  - [x] Flatten parent-first trees with stable sibling order
  - [x] Return the contiguous `[root, ...descendants]` block for a dragged task
  - [x] Remove and insert a subtree block without splitting descendants
  - [x] Project target depth and parent from vertical destination plus horizontal offset
  - [x] Clamp projection to the previous row's depth + 1 and maximum depth 5
  - [x] Prevent projection into the dragged subtree
  - [x] Preserve descendant relative depth when the root depth changes
  - [x] Calculate target sibling index separately from flat render index
  - [x] Support Collection/Inbox scope and Daily date scope
- [x] Add exhaustive pure tests
  - [x] Leaf reorder at every list boundary
  - [x] Parent block reorder with multiple descendant depths
  - [x] Indent, outdent, and reparent projections
  - [x] Invalid descendant target
  - [x] Maximum-depth subtree clamp/rejection
  - [x] Cross-container root move
  - [x] Stable order for equal `orderValue`
  - [x] Property test that every descendant remains after its ancestor and no ID is duplicated or lost

## Phase 4 - Task row interaction and editing

- [x] Refactor `TaskList`
  - [x] Remove its private `DndContext`
  - [x] Keep a `SortableContext` registered under the shell provider
  - [x] Accept a stable container ID and ordering-scope metadata
  - [x] Register empty lists as droppable containers
  - [x] Replace flat `onReorder(tasks)` with structural move callbacks
- [x] Refactor `TaskItem`
  - [x] Add complete task/parent/container metadata to `useSortable`
  - [x] Allow press-drag from the row while excluding interactive descendants
  - [x] Retain the drag handle as the keyboard activator and visible hover affordance
  - [x] Hide or dim descendants represented by the active parent's overlay during drag
  - [x] Add `onDoubleClick` that calls `onStartEdit(task.id)`
  - [x] Stop invoking a selection callback on single click
  - [x] Keep checkbox/note controls from triggering edit or drag
- [x] Remove selection plumbing
  - [x] Remove `selectedTaskId`, `onTaskClick`, and `isSelected` from task list/item public props
  - [x] Remove `selectedId` state and setter calls from Inbox, Daily, and Collection pages
  - [x] Remove `.task-item--selected` styling
  - [x] Keep `editingId` as the only row interaction state
  - [x] Keep keyboard focus navigation independent from Planner selection state
- [x] Add component tests
  - [x] Single click does not select or edit
  - [x] Double-click enters edit mode
  - [x] Toggle click only toggles completion
  - [x] Drag activation does not fire from input, checkbox, menu, or detail controls
  - [x] Keyboard drag handle remains named and focusable

## Phase 5 - Task page integration

- [x] Collection page
  - [x] Register one collection-scoped task container
  - [x] Optimistically move/reparent task subtrees
  - [x] Patch cache from `TaskMoveResponse`
  - [x] Roll back and invalidate the current collection on failure
- [x] Inbox page
  - [x] Resolve the user's Inbox collection ID for move requests
  - [x] Register Inbox as a collection-scoped task container
  - [x] Preserve completed tasks in their exact manual positions
  - [x] Roll back and invalidate Inbox on failure
- [x] Daily page
  - [x] Register each rendered date section as a droppable task container
  - [x] Lift drag handling above individual `TaskList` instances so tasks can cross dates
  - [x] Allow open and completed tasks to move within and between rendered days
  - [x] Apply the target date to the entire subtree when crossing sections
  - [x] Keep the moved task's collection unless reparented under another collection's task
  - [x] Remove an empty overdue section after its last task moves away
  - [x] Keep Today rendered even when empty
  - [x] Do not create arbitrary unrendered future-day targets
- [x] Update task API mappings
  - [x] Preserve `parentTaskId`, `sectionId`, collection ID, due date, depth, and order value in every page model
  - [x] Ensure optimistic temporary tasks cannot be moved to the server until their real ID is resolved
  - [x] Either disable drag for temporary rows or remap a queued move after creation using existing offline ID remapping
        (a `temp-` row refuses the move and says so; the queue also rewrites ids
        for a move that was already queued behind an offline create)

## Phase 6 - Sidebar collection drops

- [x] Make every named collection and sub-collection row a task drop target
  - [x] Keep collection rows sortable when the active entity is a collection
  - [x] Highlight the full row when an active task can be dropped there
  - [x] Do not navigate when the drop gesture ends
- [x] Make Inbox navigation a task drop target
  - [x] Resolve and attach the Inbox collection ID
  - [x] Use the same top-level append behavior as named collections
- [x] Implement desktop cross-sidebar drops
  - [x] Keep Sidebar and routed page inside the shared drag provider
  - [x] Preserve collection-tree drag behavior and horizontal collection projection
  - [x] Filter collision targets so task and collection drags cannot interfere
- [~] Implement mobile edge-open — MOVED to Phase 12 on 2026-07-19. Superseded by manual
  sidebar toggle: a user who can pin the sidebar open does not need an edge-hold gesture
  to reach a drop target mid-drag. Desktop sidebar drops ship without either.
- [x] Add integration tests for named collection, sub-collection, Inbox, same-collection promotion and invalid target (mobile edge-open deferred)

## Phase 7 - Manual task ordering in views

- [x] Update task view ordering so manual order survives reload
  - [x] Collection view no longer sorts primarily by completion state
  - [x] Inbox view no longer sorts primarily by completion or priority
  - [x] Daily view no longer sorts primarily by priority
  - [x] Build parent-first trees from `parentTaskId`
  - [x] Sort siblings by `orderValue`, then `createdAt`
  - [x] Keep completed/open rows interleaved exactly as persisted
- [x] Cover legacy and malformed trees
  - [x] Promote a task with a missing parent to the root rather than hiding it
  - [x] Prevent infinite traversal if legacy data contains a cycle
  - [x] Preserve every accessible task exactly once
- [x] Update view-service unit/property tests to assert parent-first manual ordering and completed-task interleaving

## Phase 8 - Habit move service and endpoints

- [x] Add `PATCH /api/v1/habits/:id/move`
  - [x] Validate ownership, parent/group IDs, one-level hierarchy, and position
  - [x] Reject self-parenting and making a parent-with-children a sub-habit
  - [x] Move roots between ungrouped and named group scopes
  - [x] Move leaves into or out of a parent's child scope
  - [x] Normalize source and target sibling order values transactionally
  - [x] Preserve a moved parent's children and their relative order
  - [x] Keep child `group_id` null because group membership is inherited from the parent
  - [x] Seed an existing habit's completions from its new parent when it becomes a sub-habit
  - [x] Return every habit whose hierarchy or order changed
  - [x] Publish an updated habit sync event with affected IDs
- [x] Add `PATCH /api/v1/habit-groups/:id/move`
  - [x] Validate ownership and non-negative integer position
  - [x] Reorder all user groups transactionally with gap-based values
  - [x] Return every group whose order changed
  - [x] Publish an updated habit-group sync event
- [x] Add service/route tests
  - [x] Root reorder within ungrouped scope
  - [x] Root move into and out of a group
  - [x] Journaling-style root move into Morning Routine-style group
  - [x] Sub-habit sibling reorder
  - [x] Leaf becomes sub-habit and inherits completion seeds
  - [x] Sub-habit becomes root in a target group
  - [x] Parent-with-children moves groups with children intact
  - [x] Invalid third-level hierarchy rejection
  - [x] Group reorder
  - [x] Transaction rollback

## Phase 9 - Habit drag and editing UI

- [x] Add pure habit projection helpers
  - [x] Flatten ungrouped roots, groups, roots inside groups, and child rows into stable drag containers
  - [x] Move a parent and child block together
  - [x] Project root versus child using 24px horizontal movement
  - [x] Prevent a parent-with-children from projecting to child depth
  - [x] Calculate target `parentId`, `groupId`, and sibling position
- [x] Timeline mode
  - [x] Make habit rows and group headers sortable through the shared provider
  - [x] Make ungrouped and every group section droppable, including empty groups
  - [x] Make every parent a valid child-container target for leaf habits
  - [x] Preserve collapsed-state behavior while dragging a subtree
  - [x] Keep habit completion day cells non-draggable
  - [x] Preserve existing double-click inline editing for groups, roots, and sub-habits
- [x] Calendar mode
  - [x] Make each visible root habit card sortable
  - [x] Make ungrouped and group sections droppable
  - [x] Support root reorder and root group moves
  - [x] Do not expose or drag hidden sub-habits in Calendar mode
  - [x] Add inline rename state to visible card headings
  - [x] Double-click/double-tap a card heading to edit and reuse existing commit/cancel handlers
  - [x] Keep month/day tracking controls non-draggable
- [x] Group movement
  - [x] Make group headers sortable in both views
  - [x] Dragging a group reorders the group and carries its displayed contents
  - [x] Group drop indicators remain aligned to the 24px grid
- [x] Add component/integration tests for root reorder, group move, sub-habit reorder, hierarchy projection, Calendar rename, and invalid third-level drops

## Phase 10 - Optimistic state, offline queue, and sync

- [x] Add reusable optimistic move helpers for task and habit query caches
  - [x] Snapshot all affected cache keys before mutation
        (each drag hook snapshots the list it owns before mutating and restores it
        on failure; sibling views are invalidated rather than snapshotted, since
        they hold no optimistic state to roll back)
  - [x] Apply the full projected move immediately
  - [x] Patch authoritative IDs/order values from successful responses
  - [x] Restore snapshots and invalidate on failure
- [x] Integrate with offline mutation replay
  - [x] Route move calls through the existing `request()` mutation path
  - [x] Queue structural move bodies while offline
  - [x] Remap temporary task IDs in move paths and parent/body references after create replay
  - [x] Preserve FIFO ordering for create-then-move sequences
  - [x] Revalidate target position against current server state during replay and clamp safely
        (clamped server-side in the move transaction, against the list as it is at
        replay time - the client's queued index cannot be trusted by then)
- [x] Sync all affected views
  - [x] Task moves invalidate Inbox, Daily, involved Collection pages, and collection sidebar counts if present
  - [x] Habit moves invalidate habits and habit-group queries
  - [x] Ignore a matching echoed event while the local optimistic operation is still reconciling
- [x] Add offline and multi-client tests
  - [x] Offline reorder survives reload and replays
  - [x] Offline create then move remaps IDs correctly
  - [x] Failed replay restores/refetches authoritative order
  - [x] A move from another client appears without duplicating or losing rows

## Phase 11 - Acceptance verification

- [x] Run static verification
  - [x] `git diff --check`
  - [x] App TypeScript production build
  - [x] API TypeScript production build
  - [x] Full app test suite
  - [x] Full API test suite
- [ ] Verify desktop behavior in Chromium DevTools
  - [ ] Reorder top-level tasks and subtasks
  - [ ] Reparent through horizontal drag
  - [ ] Drag a parent and confirm descendants follow
  - [ ] Move completed tasks between open tasks and reload
  - [ ] Move open and completed tasks between rendered Daily dates and reload
  - [ ] Drop tasks onto Inbox, root collections, and sub-collections
  - [ ] Move a subtask to its current collection and confirm top-level promotion
  - [ ] Move Journaling into Morning Routine
  - [ ] Reorder sub-habits and habit groups
  - [ ] Rename task, habit, sub-habit, and Calendar habit by double-click
  - [ ] Confirm single click does not select a task
- [ ] Verify mobile behavior at representative narrow widths
  - [ ] Long-press reorder without blocking normal vertical scroll
  - [ ] Long-press completed task and move it between Daily dates
  - [~] Hold at left edge, auto-open sidebar, and drop on a collection — N/A, see Phase 12
  - [ ] Cancel drag and confirm sidebar/state restoration
  - [ ] Double-tap edit remains distinct from long-press drag
- [ ] Verify accessibility
  - [x] Keyboard reorder remains operable — verified 2026-07-19 on Daily: space/ArrowUp/space
        moved a task up one slot, order survived reload, restored cleanly with ArrowDown
  - [ ] Keyboard hierarchy movement (reparent via arrow keys) remains operable
  - [x] Task drag handles have descriptive labels — `Reorder <task name>` on all 34 main-region handles
  - [x] Sidebar collection handles have descriptive labels — was a generic `Drag to reorder`;
        FIXED to `Reorder <collection name>` in CollectionTreeNav
  - [x] Live region announces pickup, projected target, invalid target, drop, and cancel
    - [x] Pickup — polite: `Picked up <task name>.`
    - [x] Drop — polite: `Moved under <task name>.`
    - [x] Projected target — was a DEFECT: the polite region did not update while arrowing,
          and dnd-kit's own assertive region emitted raw UUIDs (`Draggable item fb7d5e86-…
    was moved over droppable area 2ffc167d-…`). FIXED two ways: dnd-kit's built-in
          region is suppressed via `accessibility.announcements` on DndContext, and both
          entity hooks gained an `onDragOver` that speaks the projected target
          (`Drop to place under <task name>.`). Verified live: assertive region now empty.
    - [x] Invalid target — `That is not a valid place to drop this task.`
    - [x] Cancel — polite: `Move cancelled.`, verified live via Escape
  - [x] Focus returns to the moved row after drop — verified, focus landed on the moved handle
  - [ ] Reduced-motion preference removes nonessential drag transitions
- [~] Verify performance and optimize based on trace analysis (2026-07-20)
  - [~] HIGH: Reduce nesting phase layout recalculations
    - [x] Profile indentation depth calculation during drag
    - [x] Cache nesting level; update only on threshold change — already the case:
          `createIndentTracker` + `PlannerDragProvider` quantise `delta.x` to whole
          INDENT_PX steps and skip the state write when the step is unchanged, so a
          pointer move only re-renders when the projected depth actually changes
    - [x] Replace per-move `getComputedStyle()` — N/A: no `getComputedStyle` call
          exists in app source, and @dnd-kit does not call it per move either. Depth
          already travels as the `--row-indent` custom property.
    - [ ] Target: 10 layouts → 3 layouts, eliminate 1.4ms overhead — NOT re-traced
  - [~] HIGH: Memoize parent components to reduce commit frequency
    - [x] Profile React renders during drag
    - [x] Identify parent containers re-rendering on every child state change —
          `TaskList` was the hot one. It re-runs on every drag frame (indentSteps,
          overId, hasMoved all change), and rebuilt `flattenTasks` plus an O(n²)
          `getSubtreeBlock`-per-row map each time. `TaskItem` was already `memo`'d
          but the memo never held: `subtreeIds` and `renderBadge(task)` handed it a
          fresh array and a fresh element on every render.
    - [x] Wrap with `React.memo()` and `useMemo()` dependencies — `allRows`,
          `subtreeIdsOf` (now the O(n·depth) `buildSubtreeIndex`), `badges`, `rows`
          and `draggedBlock` are memoised on `tasks`, so row props keep their
          identity across drag frames and untouched rows stop re-rendering
    - [ ] Target: 159 commits/sec → 90 commits/sec — NOT re-traced
  - [x] HIGH: Reduce IntersectionObserver throttling — N/A. No `IntersectionObserver`
        exists in app source (only HelpPage) and none in @dnd-kit; the 964 calls in
        the trace did not come from this app's own code.
  - [ ] MEDIUM: Investigate and fix jank frames
    - [ ] Identify 47 frames exceeding 16.67ms budget (3% jank rate)
    - [ ] Determine cause: layout, paint, JavaScript, or GC
    - [ ] Batch work to separate frames; use `will-change: transform` hints
    - [ ] Target: <1% jank rate
  - [ ] MEDIUM: Optimize memory allocations to reduce GC pauses
    - [ ] Profile heap allocations with Chrome DevTools Memory tab
    - [ ] Identify high-frequency temporary objects in drag path
    - [ ] Implement object pooling for event objects, state clones
    - [ ] Avoid spread operators in hot paths
    - [ ] Target: 92ms GC pause → <20ms
  - [ ] MEDIUM: Validate and optimize drop-target detection logic
    - [ ] Review collision-detection efficiency (O(n) vs O(log n))
    - [ ] Cache drop-zone bounding rectangles at drag start
    - [ ] Update cache only on scroll/resize, not per mouse move
    - [ ] Confirm spatial indexing or zone-based detection if needed
  - [ ] LOW: Mobile/low-end device testing
    - [ ] Test on throttled device (CPU 4x slowdown, 4G network)
    - [ ] Verify 60 FPS target is achieved
    - [ ] Adjust task batching if needed
  - [x] LOW: Validate GPU acceleration (verify complete)
    - [x] Confirm drag ghost uses `transform` not `left`/`top` — dnd-kit's
          `DragOverlay` positions by `transform`; no `left`/`top` animation
    - [x] Verify `will-change: transform` present on drag ghost — was missing,
          ADDED to `.planner-drag-overlay--block`
    - [x] No layout-triggering CSS properties during drag — the overlay's `border`
          was replaced by `outline` (see the drag-card defects below), which also
          takes the box out of layout

## Phase 11b - Drag presentation and input defects (2026-07-20)

Reported from live use while the performance pass was under way.

- [x] Dragged card lost its bullet on pickup and regained it on first move —
      `TaskList` only published `overlayNode` once `hasMoved`, so the first frames
      showed the provider's fallback title chip. The overlay is drawn over the
      list rather than in it, so publishing the real block immediately reflows
      nothing; the `hasMoved` gate stays on the list's own layout only.
- [x] Dragged card stood ~6px taller than the row it came from — the overlay added
      `border: 1px` plus `2px` vertical padding to a 24px row. Now `outline` and no
      vertical padding, so the lifted row matches the row exactly.
- [x] Dragged card is translucent (70%) so the rows beneath stay readable
- [x] Dragged card keeps the row's exact font, size, height and weight —
      `TaskBlockPreview` was drawing 13px/`leading-6` text against the row's 14px
      `--task-line-height`; it now mirrors `TaskItem`'s own marker and title styles
      and shares its `priorityClasses`
- [x] A date with no tasks showed no landing slot — two independent causes, both
      fixed and both verified in Chromium against the running app:
  - [x] An empty list collapses to zero height, so its droppable had no area for
        the pointer to be inside. `.task-list--empty-target` claims one row while
        a drag is in flight and cancels it with an equal negative margin, so the
        layout is unchanged. Both halves are needed, and each was tried alone
        first: reserving the height permanently left a visible blank line under
        every empty date; reserving it without the negative margin grew the
        content by 24px on pickup, and dnd-kit answers a mid-drag layout shift by
        moving the scroll — measured as `scrollTop` 400 → 424 on press and back
        to 400 on release. Verified: 0px at rest, `scrollHeight` identical before
        and during the drag.
  - [x] `closestCenter` names a winner whenever it has any candidate, so
        resolving rows before containers meant a row elsewhere on the page always
        beat the empty day the pointer was inside. `plannerCollisionDetection`
        now reads the container under the pointer first and picks among *its*
        rows, falling back to the container when it has none.
- [x] Releasing a drag scrolled the page — two causes:
  - [x] dnd-kit auto-scrolls whenever the *dragged rect* sits in a threshold band
        at a scroll edge (20% by default), re-evaluated every frame whether or
        not the pointer has moved, so a press near the top or bottom scrolled on
        its own. Band tightened to 8% and horizontal auto-scroll switched off.
  - [x] dnd-kit's focus restore calls a bare `.focus()`, which scrolls the row
        into view. Its pass is disabled (`accessibility.restoreFocus: false`) and
        the provider restores the drag's original focus itself with
        `preventScroll: true`, so keyboard users keep the focus return.
  - [x] Verified: `scrollTop` holds at 400 and at 900 across press, 1.2s hold and
        release, with the row in the top band and the bottom band.
- [x] Press-and-hold delay reduced 180ms → 120ms

## Phase 12 - Sidebar state control (deferred, not started)

Requested 2026-07-19. Replaces the mobile edge-open approach dropped from Phase 6.
Requirements to be confirmed before implementation.

- [ ] Let the user manually collapse and expand the sidebar
- [ ] Persist the collapsed/expanded state across reloads and sessions
- [ ] Decide whether state is per-device (localStorage) or per-account (preferences service)
- [ ] Define collapsed-state behavior as a drag drop target
- [ ] Keep the toggle keyboard-operable and announced to assistive technology

## Phase 13 - Defects from the recorded walkthrough (2026-07-21)

Source: screen recording with narration, `~/Videos/2026-07-21 10-44-57.mkv`, reproduced
on the Daily page. Grouped by area; the drag items are the priority.

### 13.1 Drop positions the projection refuses to offer

- [ ] Allow a drop into the **last** position of a day. Every drop resolves to first
      or middle; the final slot is never offered, on any date
- [ ] Allow a drop **below a completed task**. Dropping under a struck-through row
      (e.g. "Buscar bupropiona") is refused and the row is thrown to the top instead
- [ ] Allow a completed task itself to be dragged anywhere in the order. Stated
      requirement: any task, complete or not, moves to any position - the user is free
- [ ] Reconsider the midpoint-crossing threshold: a drop currently needs the pointer
      past half the target row, which reads as unresponsive (noted as tolerable, not blocking)

### 13.2 Nesting that does not take

- [ ] Dropping below "Pesquisar a vitamina do Luke" applied neither the indent nor the
      position - the row went to the end of the list instead, and that wrong result persisted
- [ ] Indentation worked on later attempts in the same session, so this is intermittent:
      find the state that distinguishes the working case from the failing one
- [ ] A row dropped as the child of another must persist as its child, at the dropped position

### 13.3 Drag overlay presentation

- [ ] Drop the `border-radius` on the floating card - it should read as the same block
      that was picked up, not a rounded copy of it
- [ ] Fix the right edge: the translucency stops short and leaves a strip of opaque cream

### 13.4 Task editing (not drag, found alongside)

- [ ] `-` converts a task to a note only while the input is empty
      (`TaskItem.tsx:222`, `e.currentTarget.value === ''`). Typing `- ` at the start of
      an existing line must convert it too. Same gate on `[`, `]`, `*` for note→task
      (`TaskItem.tsx:225-229`)
- [ ] Committing with Enter does not keep the row where it sits: the saved row jumps to
      first position instead of staying under the row it was added below
- [ ] After a reload, that row had moved to **today** - the date it was created under
      was not what persisted. It stayed a note, so the type survived and the date did not

### 13.5 Console error, present throughout the recording

- [ ] `NotFoundError: Failed to execute 'index' on 'IDBObjectStore': The specified index
      was not found` - `offlineQueue.ts:88`, via `getQueuedMutationsForUser`
      (`offlineQueue.ts:134`) from `useOfflineQueueReplay.ts:13`. Fires on every page load;
      the offline replay path is broken, so queued mutations are likely never replayed

## Completion criteria

- [x] Every active task row on Inbox, Daily, and Collection pages can be press-dragged, including completed tasks
- [x] Task hierarchy, Daily date, collection, subtree, and exact manual order persist after reload
- [ ] Every visible habit can be press-dragged in both Habit modes within the mode's visibility constraints
- [ ] Sub-habits and habit groups can be manually reordered and persist after reload
- [ ] Sidebar collection and Inbox drops work on desktop (mobile edge-open half moved to Phase 12)
- [x] No task row selection remains; double-click/double-tap edits directly
- [x] No unrelated dirty worktree files are reverted or included in implementation commits
- [ ] All automated and browser acceptance checks pass
