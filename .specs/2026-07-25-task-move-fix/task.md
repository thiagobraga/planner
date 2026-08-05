# Task Move Fix — Tasks

- [x] `app/src/utils/taskProjection.ts`: change `projectMove`/`applyProjection` to take `overId: string | null`, resolve index internally via shared `resolveAt(rest, overId)` helper
- [x] `app/src/hooks/useTaskDrag.ts`: update `resolveMove` to pass `over.taskId` instead of pre-removal `scopedIndex`
- [x] `app/src/components/TaskList.tsx`: update `projectMove` call to pass `overId` directly instead of derived `overIndex`
- [x] `app/src/utils/__tests__/taskProjection.test.ts`: migrate call sites to `overId`; add regression test for dragging an earlier sibling down past a later one
- [x] `app/src/hooks/__tests__/useTaskDrag.parity.test.ts`: migrate call site; add `position` parity assertion
- [x] `api/src/services/taskService.ts`: add `midpointOrFallback()` helper
- [x] `api/src/services/taskService.ts`: rewrite `renumberCollectionScope` for midpoint insertion + full-renumber collision fallback
- [x] `api/src/services/taskService.ts`: delete `normalizeCollectionScope` and its call site (`sourceDiffers` branch)
- [x] `api/src/services/taskService.ts`: rewrite `renumberDayScope` for midpoint insertion (seeded-neighbors fast path) + existing full-seed fallback
- [x] `api/src/services/taskService.ts`: delete `normalizeDayScope` and its call site
- [x] `api/src/services/taskService.ts`: replace `reorderedResult` re-query in `moveTask` with direct use of renumber helpers' return values
- [x] `api/src/services/taskService.ts`: add `MovedTaskSummary` type, map `moved`/`reordered` to it before returning
- [x] `app/src/api/client.ts`: change `TaskMoveResponse.moved`/`.reordered` to `MovedTaskSummary[]`
- [x] `app/src/hooks/useTaskDrag.ts`: update `.then()` handler types; add no-op-diff guard to preserve object identity for unchanged tasks
- [x] `api/src/services/__tests__/taskService.move.test.ts`: update gap-write assertions, add collision-fallback test, split day-scope seeded/unseeded test cases
- [x] Optional: migration `031_task_collection_scope_index.sql` adding `idx_tasks_collection_scope_ordered` (use `db-migration` skill)
- [x] `api/src/services/taskService.ts`: in `renumberDayScope`, return `position` as `orderValue` in `MovedTaskSummary` so day-scoped task ordering is preserved in frontend state without snapping back to `createdAt`
- [x] `api/src/services/viewService.ts`: in `getTodayView` and `getUpcomingView`, select `COALESCE(o.position, t.order_value) AS order_value` so tasks carry effective day position
- [x] `api/src/services/taskService.ts`: `moveTask`'s post-commit `moved` query (the subtree re-read at line ~998) reported raw `tasks.order_value` for day-scoped moves - always `0`/stale, since day moves only ever write `task_order.position`. The client applies `moved` as the authoritative patch right after the optimistic reorder, so this handed every day-scoped move an `orderValue: 0` the instant the request resolved, snapping the row back to the front of the list - this is the reported "orderValue: 0" bug. Fixed by LEFT JOINing `task_order` in that query and reporting `day_position ?? order_value`. Regression test: `taskService.move.test.ts` > "reports the day position, not the untouched collection order_value, in `moved`".
- [x] `app/src/hooks/useTaskDrag.ts`: `applyMoveLocally` never set `orderValue` on the optimistically-moved task, so the immediate re-sort (siblings order by `orderValue`) left the row exactly where it started until the response patched it - a second, independent cause of the same-looking unreliability. Added a same-space midpoint estimate (`ResolvedMove.orderValue`) computed in `resolveMove` and applied in `applyMoveLocally`. Regression tests: `useTaskDrag.parity.test.ts` > "optimistic orderValue matches the projected slot".
- [ ] `app/src/hooks/useSync.ts` / `AppShell.tsx`: update state / invalidate queries when a task is created via QuickAdd so tasks created for yesterday or today immediately appear on `DailyPage` without manual refresh
- [ ] `app/src/hooks/useTaskDrag.ts`: update `scopedRows` filter to preserve undated tasks belonging to the current view section
- [ ] `app/src/utils/taskProjection.ts` & `TaskList.tsx` & `collision.ts`: support dropping after the last item in a list or container
- [ ] Write unit & integration tests covering yesterday QuickAdd creation, day-scope reordering persistence, end-of-list drops, and subtask reparenting
- [ ] Manual browser verification: QuickAdd yesterday task, drag to last position, drag as child under last task, subtask reordering and persistence
  - [x] Wrong-position repro (Daily): registered a throwaway test account against
    the running isolated stack (localhost:5174/4001, shared dev DB), created 3
    day-scoped tasks A/B/C, dragged A past C. Confirmed directly in Postgres
    (not just the UI) that the result is `B, A, C` — A landed immediately
    before C, matching the fix, not past it. Test account and its data were
    deleted afterward.
  - [ ] Response payload size in Network tab / React Profiler re-render check /
    cross-collection drag: not completed. The MCP browser-automation `drag`
    tool doesn't reliably trigger this app's dnd-kit pointer sensor (the one
    keyboard-driven drop that did fire a move request also intermittently
    toggled task completion via a colliding Space-key shortcut, unrelated to
    this branch) — a tooling limitation of this verification pass, not a
    finding against the fix. The two independent whole-branch code reviews
    traced the payload-size and orderValue-correctness claims through the
    actual code and pinned them with tests instead; a human should still spot
    check this in a real browser before/after merging if that matters.

## Follow-up video (2026-08-04 22:30) — post-fix repro

User recorded a second pass after the `orderValue: 0` fix above landed. Basic
same-day and cross-day reordering is now stable and persists across reloads
(confirmed in-video: dragging "Talk to someone" around the AUG 04 list, and
across the day boundary into AUG 05/Today, both survive the round-trip). Two
bugs remained, captured as tasks typed directly into the app during the
recording (`AUG 05 WED · TODAY`):

- [x] **"Fix: moving to last not working"** — dragging a task from one day's
  list and dropping it intending the *last* position of the target day
  landed it one slot too early instead. Traced to `app/src/components/dnd/collision.ts`:
  a populated list's last row only counted as "append past the end" once the
  pointer crossed *below that row's own vertical midpoint*. Dragging in from
  a source list rendered further down the page (AUG 04, below TODAY) means
  the pointer reaches TODAY's last row from underneath and typically first
  lands on its upper half or center - never crossing the midpoint - so it
  resolved as "insert before the last row" instead of "append". Fixed by
  relaxing the threshold to the last row's *top* edge specifically for a
  foreign drag (one whose source container differs from the target's): a
  drop arriving from elsewhere and landing anywhere on the last row
  overwhelmingly means "add it to the end", not "slot in just above the last
  item" - and that narrower reading is still reachable by hovering the row
  above the last one instead. Same-list reordering keeps the stricter
  midpoint threshold unchanged, so "insert directly before the last row" by
  hovering it is still possible there. Regression tests:
  `collision.test.ts` > "cross-day drop aimed at the end of a short list".
- [x] **"Fix: also fix these bugs I showed here"** — user followed up with a
  Chrome performance trace (`Trace-20260804T230002.json.gz`) of the same
  drag gesture. It showed the main thread saturated with back-to-back
  30-40ms script chunks for the whole ~5s gesture (window ~47050890000 to
  ~47056000000 in trace timestamps) - not the network requests, which were
  fast (40-110ms each), but continuous scripting during the drag itself.
  Breakdown of that window: 369 calls into `react-dom`'s `dispatchContinuousEvent`
  (the `pointermove` handler), 254 calls into `@dnd-kit/utilities` rect
  recalculation, 31 calls to dnd-kit's `handleMove`. Root cause: `DndContext`
  in `app/src/contexts/PlannerDragContext.tsx` had no `measuring` config, so
  dnd-kit used its default `MeasuringStrategy.WhileDragging` - re-measuring
  every registered droppable's rect on every animation frame, and this app
  has exactly one `DndContext` for the whole shell, so that means every task
  row across every rendered day, every habit, every sidebar collection, on
  every pointer move. Fixed by setting `droppable: { strategy:
  MeasuringStrategy.BeforeDragging }`: sortable rows shift via CSS transform
  computed from each row's rect measured once at drag start plus the live
  index delta, so dnd-kit does not need continuous re-measurement to keep
  that correct - this is the standard dnd-kit performance fix for exactly
  this shape of setup. Stale rects during a saturated main thread are also a
  plausible contributor to the "moving to last" bug above being harder to
  hit reliably than the isolated collision.ts fix alone would suggest.
  `TaskItem` was already `memo`-wrapped with stable props across drag
  frames, so no additional per-row memoization work was needed on top of
  this. No dedicated regression test - this is a `DndContext` configuration
  change with no independently-observable behavior at the unit level; the
  existing collision/drag test suites (775 tests) all still pass unchanged,
  confirming no functional regression. Verify with a fresh performance trace
  after this lands.

## Migrated from .specs/2026-07-25-drag-polish-defects/task.md

### From .specs/2026-07-18-unified-task-habit-dragging/task.md

- [ ] Implement mobile edge-open — MOVED to Phase 12 on 2026-07-19. Superseded by manual
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
  - [ ] Hold at left edge, auto-open sidebar, and drop on a collection — N/A, see Phase 12
  - [ ] Cancel drag and confirm sidebar/state restoration
  - [ ] Double-tap edit remains distinct from long-press drag
- [ ] Verify accessibility
  - [ ] Keyboard hierarchy movement (reparent via arrow keys) remains operable
  - [ ] Reduced-motion preference removes nonessential drag transitions
- [ ] Verify performance and optimize based on trace analysis (2026-07-20)
  - [ ] HIGH: Reduce nesting phase layout recalculations
    - [ ] Target: 10 layouts → 3 layouts, eliminate 1.4ms overhead — NOT re-traced
  - [ ] HIGH: Memoize parent components to reduce commit frequency
    - [ ] Target: 159 commits/sec → 90 commits/sec — NOT re-traced
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
- [ ] Let the user manually collapse and expand the sidebar
- [ ] Persist the collapsed/expanded state across reloads and sessions
- [ ] Decide whether state is per-device (localStorage) or per-account (preferences service)
- [ ] Define collapsed-state behavior as a drag drop target
- [ ] Keep the toggle keyboard-operable and announced to assistive technology
- [ ] Allow a drop into the **last** position of a day. Every drop resolves to first
- [ ] Allow a drop **below a completed task**. Dropping under a struck-through row
- [ ] Allow a completed task itself to be dragged anywhere in the order. Stated
- [ ] Reconsider the midpoint-crossing threshold: a drop currently needs the pointer
- [ ] Dropping below "Pesquisar a vitamina do Luke" applied neither the indent nor the
- [ ] Indentation worked on later attempts in the same session, so this is intermittent:
- [ ] A row dropped as the child of another must persist as its child, at the dropped position
- [ ] Drop the `border-radius` on the floating card - it should read as the same block
- [ ] Fix the right edge: the translucency stops short and leaves a strip of opaque cream
- [ ] `-` converts a task to a note only while the input is empty
- [ ] Committing with Enter does not keep the row where it sits: the saved row jumps to
- [ ] After a reload, that row had moved to **today** - the date it was created under
- [ ] `NotFoundError: Failed to execute 'index' on 'IDBObjectStore': The specified index
- [ ] Every visible habit can be press-dragged in both Habit modes within the mode's visibility constraints
- [ ] Sub-habits and habit groups can be manually reordered and persist after reload
- [ ] Sidebar collection and Inbox drops work on desktop (mobile edge-open half moved to Phase 12)
- [ ] All automated and browser acceptance checks pass

### From .specs/2026-07-20-habit-drag-parity/task.md

Markers: `[ ]` not started · `[ ]` in progress · `[x]` done
- [ ] Manual browser check, steps 1-8 in `plan.md` § Verification
