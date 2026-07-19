# Unified Task and Habit Press-and-Drag

> Goal: provide persistent press-and-drag movement for tasks, task subtrees, habits, sub-habits, and habit groups across active Planner views, including Daily date moves and sidebar collection drops. Remove row selection and use double-click/double-tap for direct inline editing.

## Locked behavior

- [ ] Manual order is authoritative
  - [ ] Open and completed tasks may remain interleaved in the exact dropped position
  - [ ] Priority and completion state must not override manual order after reload
  - [ ] Stable fallback ordering uses `createdAt` only when two stored order values tie
- [ ] Task drag supports full tree movement
  - [ ] Vertical movement changes sibling position
  - [ ] Horizontal movement projects nesting in 24px increments
  - [ ] Maximum task depth remains 5
  - [ ] Dragging a parent carries its complete descendant block
  - [ ] Invalid cycle and descendant drops are rejected without mutating local or server state
- [ ] Habit drag supports the existing one-level hierarchy
  - [ ] Root habits can move between groups
  - [ ] Leaf habits can become sub-habits through horizontal projection
  - [ ] Sub-habits can be promoted to roots
  - [ ] Sub-habits can be manually reordered under the same parent
  - [ ] A habit with children cannot become a sub-habit
  - [ ] Dragging a parent habit carries its sub-habits
- [ ] Press interaction works on desktop and mobile
  - [ ] Pointer drag activates after a 180ms press with 8px movement tolerance
  - [ ] Quick scrolling before activation cancels drag instead of blocking page scroll
  - [ ] Toggles, inputs, menus, task controls, and habit day cells never initiate pointer drag
  - [ ] Keyboard dragging remains available from the accessible drag handle
- [ ] Editing is direct
  - [ ] Remove task row selection state, selected styling, and single-click selection callbacks
  - [ ] A quick single click performs no Planner selection action
  - [ ] Double-click/double-tap opens inline editing for tasks, habits, sub-habits, and habit group names
  - [ ] Existing keyboard edit, commit, cancel, delete, and add-below behavior remains available

## Phase 0 - Contracts and shared types

- [ ] Add shared frontend drag metadata types
  - [ ] `TaskDragData` includes task ID, parent ID, collection ID, due date, depth, container ID, and subtree IDs
  - [ ] `HabitDragData` distinguishes root habit, sub-habit, and habit group
  - [ ] `CollectionDropData` identifies named collections, sub-collections, and Inbox
  - [ ] `DayDropData` identifies a rendered Daily ISO date
- [ ] Add API client move contracts
  - [ ] `TaskMoveInput` contains `parentTaskId`, optional `collectionId`, optional `dueDate`, target ordering scope, and zero-based position
  - [ ] Task ordering scope is either `{ kind: 'collection', collectionId }` or `{ kind: 'day', dueDate }`
  - [ ] `TaskMoveResponse` returns all affected moved-subtree and reordered-sibling task records
  - [ ] `HabitMoveInput` contains `parentId`, `groupId`, and zero-based position
  - [ ] `HabitMoveResponse` returns the moved habit and every habit whose order changed
  - [ ] `HabitGroupMoveInput` contains a zero-based position
- [ ] Preserve existing endpoints for compatibility
  - [ ] Keep `PATCH /tasks/:id/reorder` operational but stop using it from the new UI
  - [ ] Keep name/property update endpoints separate from structural move endpoints
- [ ] Confirm no database migration is required
  - [ ] Reuse task `parent_task_id`, `collection_id`, `due_date`, `depth`, and `order_value`
  - [ ] Reuse habit `parent_id`, `group_id`, and `order_value`
  - [ ] Reuse habit-group `order_value`

## Phase 1 - Shared drag coordinator

- [ ] Add a shell-level Planner drag provider around Sidebar and routed page content
  - [ ] Own the single `DndContext` used by collections, tasks, habits, and habit groups
  - [ ] Dispatch drag lifecycle events by `active.data.current.kind`
  - [ ] Allow the currently mounted page and sidebar to register entity-specific handlers
  - [ ] Remove nested `DndContext` instances that prevent cross-sidebar drops
- [ ] Add custom sensors
  - [ ] Pointer sensor enforces the 180ms/8px press constraint
  - [ ] Pointer activator ignores interactive descendants marked as non-draggable
  - [ ] Keyboard sensor starts only from the dedicated drag handle so Space continues toggling tasks
  - [ ] Preserve sortable keyboard coordinates and screen-reader instructions
- [ ] Add type-aware collision detection
  - [ ] Task drags consider task rows, Daily containers, collection rows, and Inbox
  - [ ] Habit drags consider habit rows/cards and habit-group containers
  - [ ] Collection drags consider only collection rows
  - [ ] Prefer pointer intersection for container targets and closest-center for sortable rows
- [ ] Add shared drag presentation
  - [ ] Render `DragOverlay` outside clipped scroll containers
  - [ ] Show dragged title and descendant count
  - [ ] Show a 1px insertion line at the projected target position
  - [ ] Show projected indentation aligned to the 24px page grid
  - [ ] Highlight valid day, group, Inbox, and collection drop targets
  - [ ] Visually reject invalid targets and announce the reason through an ARIA live region
  - [ ] Enable vertical auto-scroll while dragging long lists

## Phase 2 - Task move service and endpoint

- [ ] Add `PATCH /api/v1/tasks/:id/move`
  - [ ] Authenticate before resolving source or target entities
  - [ ] Validate body shape, target scope, non-negative integer position, and ISO due date
  - [ ] Verify access to the dragged task, target parent, and target collection
  - [ ] Reject self-parenting, descendant-parenting cycles, and depth overflow
- [ ] Implement the move in one database transaction
  - [ ] Lock the dragged task, descendant subtree, source siblings, and target ordering scope
  - [ ] Compute the source subtree with a recursive CTE
  - [ ] Derive the destination parent, depth, collection, section, date, and sibling position
  - [ ] Reassign target order values using gap-based `index * 1000` ordering
  - [ ] Normalize source siblings after removal when source and target scopes differ
  - [ ] Shift descendant depths by the root depth delta
  - [ ] Update every descendant collection and section when crossing collections
  - [ ] Update every descendant due date when crossing Daily date containers
  - [ ] Preserve descendant parent relationships and relative order
  - [ ] Preserve task completion, priority, labels, recurrence, and content fields
  - [ ] Commit only after every subtree and ordering update succeeds
- [ ] Define destination rules
  - [ ] Reordering under a parent uses that parent's sibling scope
  - [ ] Reparenting inherits the parent's collection and section
  - [ ] Root reordering in Collection/Inbox uses collection scope
  - [ ] Root reordering in Daily uses date scope across collections without silently changing collection
  - [ ] Sidebar collection or Inbox drop clears the dragged root's external parent, promotes it to depth 0, and appends it
  - [ ] Dropping a subtask onto its current collection also promotes it to a top-level appended task
  - [ ] Sidebar drops preserve each moved task's due date
  - [ ] Daily cross-date drops set the target date on the entire moved subtree
- [ ] Return and synchronize affected records
  - [ ] Return all moved subtree records and source/target siblings whose order changed
  - [ ] Publish an `updated` task sync event containing the root task and affected IDs
  - [ ] Ensure other sessions invalidate Inbox, Daily, and Collection task queries
- [ ] Add service and route tests
  - [ ] Same-parent reorder upward and downward
  - [ ] Parent move carries all descendants
  - [ ] Reparent shifts descendant depth correctly
  - [ ] Cross-collection move updates every descendant collection/section
  - [ ] Cross-day move updates every descendant due date
  - [ ] Completed task remains completed and retains exact position
  - [ ] Sidebar Inbox move
  - [ ] Position clamping
  - [ ] Inaccessible collection/parent rejection
  - [ ] Cycle and maximum-depth rejection
  - [ ] Transaction rollback leaves the original tree and order untouched

## Phase 3 - Tree-aware task projection

- [ ] Extend `app/src/utils/taskTree.ts`
  - [ ] Flatten parent-first trees with stable sibling order
  - [ ] Return the contiguous `[root, ...descendants]` block for a dragged task
  - [ ] Remove and insert a subtree block without splitting descendants
  - [ ] Project target depth and parent from vertical destination plus horizontal offset
  - [ ] Clamp projection to the previous row's depth + 1 and maximum depth 5
  - [ ] Prevent projection into the dragged subtree
  - [ ] Preserve descendant relative depth when the root depth changes
  - [ ] Calculate target sibling index separately from flat render index
  - [ ] Support Collection/Inbox scope and Daily date scope
- [ ] Add exhaustive pure tests
  - [ ] Leaf reorder at every list boundary
  - [ ] Parent block reorder with multiple descendant depths
  - [ ] Indent, outdent, and reparent projections
  - [ ] Invalid descendant target
  - [ ] Maximum-depth subtree clamp/rejection
  - [ ] Cross-container root move
  - [ ] Stable order for equal `orderValue`
  - [ ] Property test that every descendant remains after its ancestor and no ID is duplicated or lost

## Phase 4 - Task row interaction and editing

- [ ] Refactor `TaskList`
  - [ ] Remove its private `DndContext`
  - [ ] Keep a `SortableContext` registered under the shell provider
  - [ ] Accept a stable container ID and ordering-scope metadata
  - [ ] Register empty lists as droppable containers
  - [ ] Replace flat `onReorder(tasks)` with structural move callbacks
- [ ] Refactor `TaskItem`
  - [ ] Add complete task/parent/container metadata to `useSortable`
  - [ ] Allow press-drag from the row while excluding interactive descendants
  - [ ] Retain the drag handle as the keyboard activator and visible hover affordance
  - [ ] Hide or dim descendants represented by the active parent's overlay during drag
  - [ ] Add `onDoubleClick` that calls `onStartEdit(task.id)`
  - [ ] Stop invoking a selection callback on single click
  - [ ] Keep checkbox/note controls from triggering edit or drag
- [ ] Remove selection plumbing
  - [ ] Remove `selectedTaskId`, `onTaskClick`, and `isSelected` from task list/item public props
  - [ ] Remove `selectedId` state and setter calls from Inbox, Daily, and Collection pages
  - [ ] Remove `.task-item--selected` styling
  - [ ] Keep `editingId` as the only row interaction state
  - [ ] Keep keyboard focus navigation independent from Planner selection state
- [ ] Add component tests
  - [ ] Single click does not select or edit
  - [ ] Double-click enters edit mode
  - [ ] Toggle click only toggles completion
  - [ ] Drag activation does not fire from input, checkbox, menu, or detail controls
  - [ ] Keyboard drag handle remains named and focusable

## Phase 5 - Task page integration

- [ ] Collection page
  - [ ] Register one collection-scoped task container
  - [ ] Optimistically move/reparent task subtrees
  - [ ] Patch cache from `TaskMoveResponse`
  - [ ] Roll back and invalidate the current collection on failure
- [ ] Inbox page
  - [ ] Resolve the user's Inbox collection ID for move requests
  - [ ] Register Inbox as a collection-scoped task container
  - [ ] Preserve completed tasks in their exact manual positions
  - [ ] Roll back and invalidate Inbox on failure
- [ ] Daily page
  - [ ] Register each rendered date section as a droppable task container
  - [ ] Lift drag handling above individual `TaskList` instances so tasks can cross dates
  - [ ] Allow open and completed tasks to move within and between rendered days
  - [ ] Apply the target date to the entire subtree when crossing sections
  - [ ] Keep the moved task's collection unless reparented under another collection's task
  - [ ] Remove an empty overdue section after its last task moves away
  - [ ] Keep Today rendered even when empty
  - [ ] Do not create arbitrary unrendered future-day targets
- [ ] Update task API mappings
  - [ ] Preserve `parentTaskId`, `sectionId`, collection ID, due date, depth, and order value in every page model
  - [ ] Ensure optimistic temporary tasks cannot be moved to the server until their real ID is resolved
  - [ ] Either disable drag for temporary rows or remap a queued move after creation using existing offline ID remapping

## Phase 6 - Sidebar collection drops

- [ ] Make every named collection and sub-collection row a task drop target
  - [ ] Keep collection rows sortable when the active entity is a collection
  - [ ] Highlight the full row when an active task can be dropped there
  - [ ] Do not navigate when the drop gesture ends
- [ ] Make Inbox navigation a task drop target
  - [ ] Resolve and attach the Inbox collection ID
  - [ ] Use the same top-level append behavior as named collections
- [ ] Implement desktop cross-sidebar drops
  - [ ] Keep Sidebar and routed page inside the shared drag provider
  - [ ] Preserve collection-tree drag behavior and horizontal collection projection
  - [ ] Filter collision targets so task and collection drags cannot interfere
- [ ] Implement mobile edge-open
  - [ ] Detect an active task pointer within 32px of the left viewport edge
  - [ ] Open the drawer after a continuous 350ms edge hold
  - [ ] Keep the drag overlay and pointer tracking active while the drawer opens
  - [ ] Prevent the sidebar overlay from intercepting the active drag pointer
  - [ ] Close the drawer after successful drop or cancellation unless it was open before drag started
  - [ ] Announce drawer opening and current collection target to assistive technology
- [ ] Add integration tests for named collection, sub-collection, Inbox, same-collection promotion, invalid target, and mobile edge-open behavior

## Phase 7 - Manual task ordering in views

- [ ] Update task view ordering so manual order survives reload
  - [ ] Collection view no longer sorts primarily by completion state
  - [ ] Inbox view no longer sorts primarily by completion or priority
  - [ ] Daily view no longer sorts primarily by priority
  - [ ] Build parent-first trees from `parentTaskId`
  - [ ] Sort siblings by `orderValue`, then `createdAt`
  - [ ] Keep completed/open rows interleaved exactly as persisted
- [ ] Cover legacy and malformed trees
  - [ ] Promote a task with a missing parent to the root rather than hiding it
  - [ ] Prevent infinite traversal if legacy data contains a cycle
  - [ ] Preserve every accessible task exactly once
- [ ] Update view-service unit/property tests to assert parent-first manual ordering and completed-task interleaving

## Phase 8 - Habit move service and endpoints

- [ ] Add `PATCH /api/v1/habits/:id/move`
  - [ ] Validate ownership, parent/group IDs, one-level hierarchy, and position
  - [ ] Reject self-parenting and making a parent-with-children a sub-habit
  - [ ] Move roots between ungrouped and named group scopes
  - [ ] Move leaves into or out of a parent's child scope
  - [ ] Normalize source and target sibling order values transactionally
  - [ ] Preserve a moved parent's children and their relative order
  - [ ] Keep child `group_id` null because group membership is inherited from the parent
  - [ ] Seed an existing habit's completions from its new parent when it becomes a sub-habit
  - [ ] Return every habit whose hierarchy or order changed
  - [ ] Publish an updated habit sync event with affected IDs
- [ ] Add `PATCH /api/v1/habit-groups/:id/move`
  - [ ] Validate ownership and non-negative integer position
  - [ ] Reorder all user groups transactionally with gap-based values
  - [ ] Return every group whose order changed
  - [ ] Publish an updated habit-group sync event
- [ ] Add service/route tests
  - [ ] Root reorder within ungrouped scope
  - [ ] Root move into and out of a group
  - [ ] Journaling-style root move into Morning Routine-style group
  - [ ] Sub-habit sibling reorder
  - [ ] Leaf becomes sub-habit and inherits completion seeds
  - [ ] Sub-habit becomes root in a target group
  - [ ] Parent-with-children moves groups with children intact
  - [ ] Invalid third-level hierarchy rejection
  - [ ] Group reorder
  - [ ] Transaction rollback

## Phase 9 - Habit drag and editing UI

- [ ] Add pure habit projection helpers
  - [ ] Flatten ungrouped roots, groups, roots inside groups, and child rows into stable drag containers
  - [ ] Move a parent and child block together
  - [ ] Project root versus child using 24px horizontal movement
  - [ ] Prevent a parent-with-children from projecting to child depth
  - [ ] Calculate target `parentId`, `groupId`, and sibling position
- [ ] Timeline mode
  - [ ] Make habit rows and group headers sortable through the shared provider
  - [ ] Make ungrouped and every group section droppable, including empty groups
  - [ ] Make every parent a valid child-container target for leaf habits
  - [ ] Preserve collapsed-state behavior while dragging a subtree
  - [ ] Keep habit completion day cells non-draggable
  - [ ] Preserve existing double-click inline editing for groups, roots, and sub-habits
- [ ] Calendar mode
  - [ ] Make each visible root habit card sortable
  - [ ] Make ungrouped and group sections droppable
  - [ ] Support root reorder and root group moves
  - [ ] Do not expose or drag hidden sub-habits in Calendar mode
  - [ ] Add inline rename state to visible card headings
  - [ ] Double-click/double-tap a card heading to edit and reuse existing commit/cancel handlers
  - [ ] Keep month/day tracking controls non-draggable
- [ ] Group movement
  - [ ] Make group headers sortable in both views
  - [ ] Dragging a group reorders the group and carries its displayed contents
  - [ ] Group drop indicators remain aligned to the 24px grid
- [ ] Add component/integration tests for root reorder, group move, sub-habit reorder, hierarchy projection, Calendar rename, and invalid third-level drops

## Phase 10 - Optimistic state, offline queue, and sync

- [ ] Add reusable optimistic move helpers for task and habit query caches
  - [ ] Snapshot all affected cache keys before mutation
  - [ ] Apply the full projected move immediately
  - [ ] Patch authoritative IDs/order values from successful responses
  - [ ] Restore snapshots and invalidate on failure
- [ ] Integrate with offline mutation replay
  - [ ] Route move calls through the existing `request()` mutation path
  - [ ] Queue structural move bodies while offline
  - [ ] Remap temporary task IDs in move paths and parent/body references after create replay
  - [ ] Preserve FIFO ordering for create-then-move sequences
  - [ ] Revalidate target position against current server state during replay and clamp safely
- [ ] Sync all affected views
  - [ ] Task moves invalidate Inbox, Daily, involved Collection pages, and collection sidebar counts if present
  - [ ] Habit moves invalidate habits and habit-group queries
  - [ ] Ignore a matching echoed event while the local optimistic operation is still reconciling
- [ ] Add offline and multi-client tests
  - [ ] Offline reorder survives reload and replays
  - [ ] Offline create then move remaps IDs correctly
  - [ ] Failed replay restores/refetches authoritative order
  - [ ] A move from another client appears without duplicating or losing rows

## Phase 11 - Acceptance verification

- [ ] Run static verification
  - [ ] `git diff --check`
  - [ ] App TypeScript production build
  - [ ] API TypeScript production build
  - [ ] Full app test suite
  - [ ] Full API test suite
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

- [ ] Every active task row on Inbox, Daily, and Collection pages can be press-dragged, including completed tasks
- [ ] Task hierarchy, Daily date, collection, subtree, and exact manual order persist after reload
- [ ] Every visible habit can be press-dragged in both Habit modes within the mode's visibility constraints
- [ ] Sub-habits and habit groups can be manually reordered and persist after reload
- [ ] Sidebar collection and Inbox drops work on desktop and through mobile edge-open
- [ ] No task row selection remains; double-click/double-tap edits directly
- [ ] No unrelated dirty worktree files are reverted or included in implementation commits
- [ ] All automated and browser acceptance checks pass
