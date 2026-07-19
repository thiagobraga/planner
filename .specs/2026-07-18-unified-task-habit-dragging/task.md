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
- [ ] Press interaction works on desktop and mobile
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
  - [x] A task holds a position in its collection *and* an independent one in its
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
- [ ] Update task API mappings
  - [ ] Preserve `parentTaskId`, `sectionId`, collection ID, due date, depth, and order value in every page model
  - [ ] Ensure optimistic temporary tasks cannot be moved to the server until their real ID is resolved
  - [ ] Either disable drag for temporary rows or remap a queued move after creation using existing offline ID remapping

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
- [ ] Implement mobile edge-open (DEFERRED by request 2026-07-19; desktop sidebar drops ship without it)
  - [ ] Detect an active task pointer within 32px of the left viewport edge
  - [ ] Open the drawer after a continuous 350ms edge hold
  - [ ] Keep the drag overlay and pointer tracking active while the drawer opens
  - [ ] Prevent the sidebar overlay from intercepting the active drag pointer
  - [ ] Close the drawer after successful drop or cancellation unless it was open before drag started
  - [ ] Announce drawer opening and current collection target to assistive technology
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

- [ ] Add reusable optimistic move helpers for task and habit query caches
  - [ ] Snapshot all affected cache keys before mutation
  - [x] Apply the full projected move immediately
  - [x] Patch authoritative IDs/order values from successful responses
  - [x] Restore snapshots and invalidate on failure
- [ ] Integrate with offline mutation replay
  - [x] Route move calls through the existing `request()` mutation path
  - [x] Queue structural move bodies while offline
  - [x] Remap temporary task IDs in move paths and parent/body references after create replay
  - [x] Preserve FIFO ordering for create-then-move sequences
  - [ ] Revalidate target position against current server state during replay and clamp safely
- [x] Sync all affected views
  - [x] Task moves invalidate Inbox, Daily, involved Collection pages, and collection sidebar counts if present
  - [x] Habit moves invalidate habits and habit-group queries
  - [x] Ignore a matching echoed event while the local optimistic operation is still reconciling
- [ ] Add offline and multi-client tests
  - [ ] Offline reorder survives reload and replays
  - [ ] Offline create then move remaps IDs correctly
  - [ ] Failed replay restores/refetches authoritative order
  - [ ] A move from another client appears without duplicating or losing rows

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
  - [ ] Hold at left edge, auto-open sidebar, and drop on a collection
  - [ ] Cancel drag and confirm sidebar/state restoration
  - [ ] Double-tap edit remains distinct from long-press drag
- [ ] Verify accessibility
  - [ ] Keyboard reorder and hierarchy movement remain operable
  - [ ] Drag handles have descriptive labels
  - [ ] Live region announces pickup, projected target, invalid target, drop, and cancel
  - [ ] Focus returns to the moved/edited row after drop or commit
  - [ ] Reduced-motion preference removes nonessential drag transitions

## Completion criteria

- [x] Every active task row on Inbox, Daily, and Collection pages can be press-dragged, including completed tasks
- [x] Task hierarchy, Daily date, collection, subtree, and exact manual order persist after reload
- [ ] Every visible habit can be press-dragged in both Habit modes within the mode's visibility constraints
- [ ] Sub-habits and habit groups can be manually reordered and persist after reload
- [ ] Sidebar collection and Inbox drops work on desktop and through mobile edge-open
- [x] No task row selection remains; double-click/double-tap edits directly
- [x] No unrelated dirty worktree files are reverted or included in implementation commits
- [ ] All automated and browser acceptance checks pass
