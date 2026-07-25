# Remaining tasks


## From .specs/2026-07-18-unified-task-habit-dragging/task.md

- [>] Implement mobile edge-open — MOVED to Phase 12 on 2026-07-19. Superseded by manual
- [>] Verify desktop behavior in Chromium DevTools
  - [>] Reorder top-level tasks and subtasks
  - [>] Reparent through horizontal drag
  - [>] Drag a parent and confirm descendants follow
  - [>] Move completed tasks between open tasks and reload
  - [>] Move open and completed tasks between rendered Daily dates and reload
  - [>] Drop tasks onto Inbox, root collections, and sub-collections
  - [>] Move a subtask to its current collection and confirm top-level promotion
  - [>] Move Journaling into Morning Routine
  - [>] Reorder sub-habits and habit groups
  - [>] Rename task, habit, sub-habit, and Calendar habit by double-click
  - [>] Confirm single click does not select a task
- [>] Verify mobile behavior at representative narrow widths
  - [>] Long-press reorder without blocking normal vertical scroll
  - [>] Long-press completed task and move it between Daily dates
  - [>] Hold at left edge, auto-open sidebar, and drop on a collection — N/A, see Phase 12
  - [>] Cancel drag and confirm sidebar/state restoration
  - [>] Double-tap edit remains distinct from long-press drag
- [>] Verify accessibility
  - [>] Keyboard hierarchy movement (reparent via arrow keys) remains operable
  - [>] Reduced-motion preference removes nonessential drag transitions
- [>] Verify performance and optimize based on trace analysis (2026-07-20)
  - [>] HIGH: Reduce nesting phase layout recalculations
    - [>] Target: 10 layouts → 3 layouts, eliminate 1.4ms overhead — NOT re-traced
  - [>] HIGH: Memoize parent components to reduce commit frequency
    - [>] Target: 159 commits/sec → 90 commits/sec — NOT re-traced
  - [>] MEDIUM: Investigate and fix jank frames
    - [>] Identify 47 frames exceeding 16.67ms budget (3% jank rate)
    - [>] Determine cause: layout, paint, JavaScript, or GC
    - [>] Batch work to separate frames; use `will-change: transform` hints
    - [>] Target: <1% jank rate
  - [>] MEDIUM: Optimize memory allocations to reduce GC pauses
    - [>] Profile heap allocations with Chrome DevTools Memory tab
    - [>] Identify high-frequency temporary objects in drag path
    - [>] Implement object pooling for event objects, state clones
    - [>] Avoid spread operators in hot paths
    - [>] Target: 92ms GC pause → <20ms
  - [>] MEDIUM: Validate and optimize drop-target detection logic
    - [>] Review collision-detection efficiency (O(n) vs O(log n))
    - [>] Cache drop-zone bounding rectangles at drag start
    - [>] Update cache only on scroll/resize, not per mouse move
    - [>] Confirm spatial indexing or zone-based detection if needed
  - [>] LOW: Mobile/low-end device testing
    - [>] Test on throttled device (CPU 4x slowdown, 4G network)
    - [>] Verify 60 FPS target is achieved
    - [>] Adjust task batching if needed
- [>] Let the user manually collapse and expand the sidebar
- [>] Persist the collapsed/expanded state across reloads and sessions
- [>] Decide whether state is per-device (localStorage) or per-account (preferences service)
- [>] Define collapsed-state behavior as a drag drop target
- [>] Keep the toggle keyboard-operable and announced to assistive technology
- [>] Allow a drop into the **last** position of a day. Every drop resolves to first
- [>] Allow a drop **below a completed task**. Dropping under a struck-through row
- [>] Allow a completed task itself to be dragged anywhere in the order. Stated
- [>] Reconsider the midpoint-crossing threshold: a drop currently needs the pointer
- [>] Dropping below "Pesquisar a vitamina do Luke" applied neither the indent nor the
- [>] Indentation worked on later attempts in the same session, so this is intermittent:
- [>] A row dropped as the child of another must persist as its child, at the dropped position
- [>] Drop the `border-radius` on the floating card - it should read as the same block
- [>] Fix the right edge: the translucency stops short and leaves a strip of opaque cream
- [>] `-` converts a task to a note only while the input is empty
- [>] Committing with Enter does not keep the row where it sits: the saved row jumps to
- [>] After a reload, that row had moved to **today** - the date it was created under
- [>] `NotFoundError: Failed to execute 'index' on 'IDBObjectStore': The specified index
- [>] Every visible habit can be press-dragged in both Habit modes within the mode's visibility constraints
- [>] Sub-habits and habit groups can be manually reordered and persist after reload
- [>] Sidebar collection and Inbox drops work on desktop (mobile edge-open half moved to Phase 12)
- [>] All automated and browser acceptance checks pass

## From .specs/2026-07-20-habit-drag-parity/task.md

Markers: `[ ]` not started · `[ ]` in progress · `[x]` done
- [>] Manual browser check, steps 1-8 in `plan.md` § Verification
