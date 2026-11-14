# Daily page drag-and-drop bug fixes — Plan

## Context

User recorded `2026-08-06 12-53-37.mkv` reproducing four bugs on the Daily
page while dragging tasks from yesterday's list into today's, plus a Chrome
performance trace and a HAR of the session. Root cause was traced for all
four by extracting 100 frames (2 fps, 0:00-0:50) with the `watch` skill,
reading the attached screenshot, and cross-referencing both against the
HAR's `PATCH /tasks/:id/move` requests/responses and the source.

Two of the four are regressions in work that already landed on `main` via
PR #90 (`feat/task-move-fix`, merged 2026-08-05) — `.specs/2026-07-25-task-move-fix/task.md`
still has unchecked items that map directly onto what's still broken. This
plan supersedes those unchecked items rather than duplicating them.

### Related prior specs

- **`.specs/2026-07-25-task-move-fix/`** (mostly done, some unchecked) —
  originally fixed "moving to last row" and a `MeasuringStrategy` perf issue.
  Bug 2 below is that same class of bug resurfacing, most likely because the
  perf fix and the hit-area fix interact badly (see Bug 2). Its remaining
  unchecked items ("support dropping after the last item", "drag as child
  under last task" manual verification) are exactly what's still broken.
- **`.specs/completed/2026-08-04-task-interactions-and-menus/`** — this is
  where the `dateFormat` preference itself was implemented (`plan.md` line 77:
  "Update section headers to format dates according to user preference").
  Bug 1 is a gap in that rollout: three call sites in `DailyPage.tsx` were
  never wired to read the preference.
- **`.specs/completed/2026-07-20-habit-drag-parity/`** — deliberately gave
  `useHabitDrag.ts` its own `IndentTracker` instance (`createIndentTracker`),
  mirroring the one `useTaskDrag.ts` already had, specifically to reach
  parity between the two drag kinds. So the "each hook keeps its own tracker,
  mirroring `PlannerDragContext`'s" pattern is intentional and repeated, not
  an accident local to tasks. Bug 3's fix (below) changes that pattern for
  tasks; `useHabitDrag.ts` likely has the same latent divergence risk and
  should get the same treatment as a fast follow-up, out of scope here since
  it isn't reproduced in the video.

## Bugs, root cause, and fix

### 1. Date format resets to default mid-drag (video 0:13)

User's preference is `DD/MM ddd` ("06/08 QUI"). The instant a drag starts
moving a task, the label flips to the hardcoded default `MMM DD ddd`
("AGO 06 QUI") and stays wrong until the page remounts (confirmed at 0:37:
navigating to Inbox and back to Daily restores the correct format).

**Root cause** — `app/src/pages/DailyPage.tsx`:
- `setAllTasks` (~line 245) calls `buildSections([], updater(...), locale, todayKey)` —
  omitting the 5th `dateFormat` parameter entirely, so `buildSections` falls
  back to its default `'MMM DD ddd'`. `setAllTasks` is what `useTaskDrag`
  calls on every optimistic update during a drag, which is why the format
  breaks specifically when dragging.
- Two more call sites have the identical omission and are latent copies of
  the same bug, not yet triggered by this recording: the `useSync` handler's
  `created`-event branch (~line 219, `dayLabel(dateFromISO(key), locale)`)
  and `handleAddTodayKeyDown` (~line 545, same call).

**Fix**: capture `prefsRef.current?.dateFormat ?? 'MMM DD ddd'` at all three
call sites (mirroring what `replaceTodayFromApi` already does correctly) and
pass it through. `prefsRef` is already in scope in `DailyPage`.

### 2. Can't drop after the last task in a list (video 0:17, 0:24)

Dragging a task onto a list only ever previews/commits "insert before" the
hovered row — there's no way to drop after the last task, before the
"Adicionar tarefa" placeholder. HAR confirms it: the `PATCH .../move` request
for this exact drag sent `"position":0` (explicit "insert first"), not an
append.

**This is a regression**, not a fresh bug. `.specs/2026-07-25-task-move-fix/task.md`
already fixed "moving to last" once (commit `0010aee`, merged in PR #90) by
relaxing `collision.ts`'s cross-list threshold to the last row's *top* edge.
That logic is still present in `app/src/components/dnd/collision.ts` (lines
126-147) and looks correct in isolation. What's different now: the **same
PR** also switched `DndContext`'s `measuring` config to
`MeasuringStrategy.BeforeDragging` (`PlannerDragContext.tsx`, `MEASURING`
constant) for performance. `TaskList.tsx`'s day-container droppable only
gets its extra 24px hit-area (the CSS that lets you drop *below* the last
row, in the seam before the next list) via a conditional class,
`task-list--drag-target`, applied only while `activeDrag` is truthy
(`padding-bottom: var(--dot-grid)` in `index.css` line 448). If dnd-kit
measures container rects once at drag-start — before React has committed the
re-render that adds this class — the container's droppable rect is captured
*without* the extra padding, and the "drop below the last row" hit-area never
actually exists for the rest of the drag. This lines up with the observed
behavior (works for lists with room above the last row, fails right at the
end) and with the timing of the two fixes landing back-to-back.

**Fix approach**: stop relying on a CSS class that appears after drag-start
to grow the droppable's hit area. Reserve the extra 24px unconditionally in
`TaskList`'s layout (e.g. always render the trailing slot in the DOM, hidden
via `visibility`/`opacity` rather than by not rendering it, so it's part of
the measured rect from the start) instead of toggling padding via a
drag-conditional class. Verify with the exact reproduction case: a day
section with exactly one existing task, drag a second task from a different
day and drop it below that task.

### 3. Child-indent preview doesn't commit (video 0:41)

Dragging a task rightward over another task previews it nesting as a child
(visible indent + caret), but releasing leaves it at the same top-level
position. HAR is unambiguous: every same-day reorder request in this session
sent `"parentTaskId":null`, never a real parent id, despite the visual
preview showing an indent multiple times in a row.

**Root cause** — there are **two independent `IndentTracker` instances**
that are supposed to mirror each other but are separately instantiated and
updated:
- `app/src/contexts/PlannerDragContext.tsx` (`indent` ref, ~line 187) drives
  `indentSteps`, the React state `TaskList`/`TaskItem` render the preview
  from.
- `app/src/hooks/useTaskDrag.ts` (`indent` ref, ~line 65) drives
  `offsetX.current`, which `resolveMove` uses to compute the actual commit.

Both consume the same dnd-kit event stream in principle, but they are
genuinely separate pieces of mutable state with no shared source of truth —
any difference in when/how each one is read (state update batching for the
preview vs. a synchronous ref read for the commit) is a live opportunity for
them to disagree, and the HAR shows they did. This is the same class of bug
flagged in project memory months ago and never resolved ("Drag-and-drop
preview/commit parity divergence when nesting above siblings"), and the
mirrored-tracker pattern was deliberately repeated for habits in
`.specs/completed/2026-07-20-habit-drag-parity/` — so this isn't a one-off
mistake, it's a structural risk in how the pattern was designed.

**Fix**: eliminate the duplication instead of chasing the specific timing
gap. Make `PlannerDragContext`'s tracker the single source of truth: expose
its live `offset()` (or the derived `indentSteps`) through the context, and
have `useTaskDrag.handleDragEnd` read that instead of maintaining its own
`indent` ref. This makes preview/commit divergence structurally impossible
rather than newly-timing-dependent. (`useHabitDrag.ts` keeps its own tracker
for now — flagged above as an out-of-scope follow-up.)

### 4. Task disappears + drop indicator renders 4 rows off (video 0:45, screenshot)

During a rapid sequence of same-day drags (the user retrying bug #3), a task
("Organizar meus remédios") vanishes from the rendered list entirely, and the
drop-target indicator renders detached, several rows below the "Adicionar
tarefa" placeholder. HAR confirms the task was never deleted server-side
(each move response returns a healthy task); this is a pure frontend
rendering defect, not data loss, and it self-heals once a drag completes
(frame t=45.4s shows all 4 tasks present again).

**Root cause**: very likely a downstream consequence of #3 — rapid same-day
drags where the optimistic `applyMoveLocally` result (already computed from a
projection that may itself be mid-desync per #3) races with an in-flight
`apiMoveTask` response patch or an `onError`-triggered `replaceTodayFromApi()`
refetch from a *previous* drag that hadn't settled yet, landing stale state
over fresh state via `setTasks`. There's no de-duplication/sequencing between
overlapping drags on the same list.

**Fix approach**: fix #3 first (removes the most likely trigger), then
reproduce with a targeted test: fire two `useTaskDrag` moves on the same list
before the first's `apiMoveTask` promise resolves, and assert the final
state reflects the second move's target, not a corrupted intermediate one.
If it still reproduces after #3 is fixed, add sequencing so a new drag's
`setTasks` optimistic apply is not clobbered by a late-arriving response for
an earlier, superseded drag (e.g. an in-flight generation counter, the same
pattern `loadRequestId` already uses in `replaceTodayFromApi`).

## Secondary finding: drag jank

Console screenshots show repeated Chrome `[Violation] 'message' handler took
174-205ms` during the same drag bursts, and the performance trace has
matching ~100-200ms `RunTask` clusters concentrated in the same window. The
prior perf fix (`MeasuringStrategy.BeforeDragging`) is still in place and
correct on its own; the remaining jank is consistent with the #3 duplication
— two independent trackers means two independent render paths reacting to
every pointer-move. Fixing #3 (single source of truth) should reduce this as
a side effect; re-profile after, but don't scope a separate perf task unless
it's still bad.

## Files to change

- `app/src/pages/DailyPage.tsx` — thread `dateFormat` through `setAllTasks`
  and the two other `dayLabel(...)` call sites (Bug 1)
- `app/src/components/TaskList.tsx` / `app/src/index.css` — reserve the
  trailing drop-slot unconditionally instead of via a drag-conditional CSS
  class (Bug 2)
- `app/src/contexts/PlannerDragContext.tsx` — expose the tracker's live
  offset/indent steps for `useTaskDrag` to consume (Bug 3)
- `app/src/hooks/useTaskDrag.ts` — drop its own `IndentTracker`, read from
  context instead; investigate/guard against overlapping drags (Bug 3, Bug 4)

## Tests to add

- `DailyPage`: a drag-triggered update preserves the user's `dateFormat`
  preference in the rendered section label (regression test for Bug 1;
  covers all three call sites via the same assertion pattern)
- `collision.ts` / `TaskList`: dropping a foreign-day task below the single
  existing row in a day section resolves to append, not insert-before
  (regression test for Bug 2 — the specific single-row case the existing
  "moving to last" test suite doesn't cover)
- `useTaskDrag` parity test (extend the existing
  `useTaskDrag.parity.test.ts`): preview `indentSteps` and committed
  `parentTaskId` agree when hovering with a horizontal offset, sourced from
  one tracker (regression test for Bug 3)
- `useTaskDrag`: two overlapping drags on the same list resolve to a
  consistent final state, no dropped/duplicated rows (regression test for
  Bug 4)

## Verification

1. `docker compose exec app npm test` — new and existing tests pass
2. `docker compose exec app npm run build` — no type errors
3. Manual, in the running dev app (`https://planner.local`), with
   `dateFormat` set to `DD/MM ddd`: drag a task from yesterday into today,
   confirm the header stays "06/08 QUI" throughout and after
4. Manual: with today holding exactly one task, drag a second task from
   another day and drop it below that task; confirm it lands after
5. Manual: drag a task to nest as a child of a sibling; confirm the dropped
   position matches the preview exactly
6. Manual: rapid-fire several same-day drags in a row (repro the 0:41-0:48
   sequence); confirm no task disappears and the drop indicator never
   renders detached from the list
7. Chrome performance trace of the same gesture; confirm no regression vs.
   the current trace and ideally fewer/shorter long tasks than before
