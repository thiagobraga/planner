# Daily page drag-and-drop bug fixes — Tasks

Source plan: `plan.md`. Related: `.specs/2026-07-25-task-move-fix/task.md`
(unfinished items this supersedes), `.specs/completed/2026-08-04-task-interactions-and-menus/`
(where `dateFormat` was introduced), `.specs/completed/2026-07-20-habit-drag-parity/`
(mirrored-tracker pattern also used by `useHabitDrag.ts`, not touched here).

## Bug 1 — date format resets mid-drag

- [x] `app/src/pages/DailyPage.tsx`: thread `dateFormat` (from `prefsRef.current?.dateFormat`)
      through `setAllTasks`'s `buildSections(...)` call
- [x] `app/src/pages/DailyPage.tsx`: same fix for the `useSync` `created`-event
      branch's `dayLabel(dateFromISO(key), locale)` call
- [x] `app/src/pages/DailyPage.tsx`: same fix for `handleAddTodayKeyDown`'s
      `dayLabel(dateFromISO(todayKey), locale)` call
- [x] Regression test: drag-triggered section rebuild preserves a non-default
      `dateFormat` preference

## Bug 2 — can't drop after the last task in a list

- [x] `app/src/components/TaskList.tsx` / `app/src/index.css`: reserve the
      trailing 24px drop-slot unconditionally in the DOM (e.g.
      `visibility`/`opacity` toggle) instead of via the drag-conditional
      `task-list--drag-target` padding class, so `MeasuringStrategy.BeforeDragging`
      captures the full hit area at drag-start
- [x] Regression test: single-row day section, foreign-day drag dropped below
      that row resolves to append (not insert-before)
- [x] Manual verification: reproduce the exact 0:17-0:24 video scenario

## Bug 3 — child-indent preview doesn't commit

- [x] `app/src/contexts/PlannerDragContext.tsx`: expose the tracker's live
      offset (or `indentSteps`) so it can be read outside the provider's own
      render
- [x] `app/src/hooks/useTaskDrag.ts`: remove its own `IndentTracker` instance;
      read the shared value from context for both preview and commit
- [x] Extend `useTaskDrag.parity.test.ts`: preview `indentSteps` and committed
      `parentTaskId` must agree for a horizontal-offset hover
- [x] Manual verification: drag a task to nest under a sibling, confirm
      dropped position matches the preview

## Bug 4 — task disappears / drop indicator renders detached

- [x] Fix Bug 3 first — likely trigger
- [x] Write a test: two overlapping `useTaskDrag` moves on the same list
      (second starts before the first's `apiMoveTask` resolves) end in a
      consistent state
- [x] If still reproducible after Bug 3: add sequencing (generation counter,
      same pattern as `loadRequestId` in `replaceTodayFromApi`) so a stale
      response/refetch cannot clobber a newer optimistic apply
      — **not needed**: `useTaskDrag.overlapping.test.tsx` drives two moves that
      overlap in flight (and an older response/failure landing after a newer
      move) and state stays consistent, so no extra sequencing was added.
- [x] Manual verification: rapid-fire several same-day drags (repro 0:41-0:48),
      confirm no task disappears and no detached drop indicator

## Follow-up (out of scope here)

- [ ] `useHabitDrag.ts` likely shares Bug 3's dual-tracker divergence risk
      (same mirrored-`IndentTracker` pattern from `2026-07-20-habit-drag-parity`)
      — not reproduced in this video, worth a dedicated check once Bug 3 lands
- [ ] Re-profile drag performance after Bug 3 lands (console showed repeated
      `[Violation] 'message' handler took 174-205ms` during drag bursts,
      matched by ~100-200ms `RunTask` clusters in the trace) — expected to
      improve as a side effect of removing the duplicate tracker/render path;
      no separate perf task unless still bad

## Verification (whole spec)

- [x] `docker compose exec app npm test`
- [x] `docker compose exec app npm run build`
- [x] Manual pass through all four repro scenarios in the running dev app
- [ ] Fresh Chrome performance trace of the same gesture, compared against
      `Trace-20260806T125339.json.gz` — not re-run; the duplicate tracker and
      its second render path are gone, which was the expected source of the
      jank, but this was not measured.

## Outcome

All four bugs fixed and verified in a real browser at `https://claude.planner.local`
with `dateFormat` set to `DD/MM ddd` (pt-BR).

- **Bug 1** — the header stayed `06/08 QUI` throughout and after a cross-day drag.
  Beyond the three call sites the plan named, `replaceTodayFromApi` had the same
  fault in a different form: it read `prefsRef.current?.dateFormat`, but that ref
  is populated by an effect that runs *after* render while the mount effect calls
  it before, so the *first* paint always used the default format with nothing
  scheduled to correct it. It now reads `prefs` directly and depends on it.
- **Bug 2** — dropping a foreign-day task below the single row in a day section
  appends. The day container's droppable rect now measures 24px past its last
  row (168 vs 144 in the live DOM) with no drag in flight, which is when
  `MeasuringStrategy.BeforeDragging` measures it.
- **Bug 3** — preview and commit agree. Hovering a sibling with a horizontal
  offset previewed *"Drop to place under Organizar meus remedios"* and committed
  *"Moved under Organizar meus remedios"*; the API then returned `depth: 1` with
  the correct `parentTaskId`, confirming it persisted rather than silently
  reverting to `parentTaskId: null`.
- **Bug 4** — five rapid same-day drags in a row: row count held at 3 throughout,
  no task vanished, and no detached drop indicator was rendered. No extra
  sequencing was required, consistent with the plan's hypothesis that this was
  downstream of Bug 3.

### Tests

97 app test files / 863 tests pass; `npm run build` is clean. New coverage:

- `app/src/pages/__tests__/DailyPage.dateFormat.test.tsx` (2)
- `app/src/hooks/__tests__/useTaskDrag.indentParity.test.tsx` (5)
- `app/src/hooks/__tests__/useTaskDrag.overlapping.test.tsx` (3)
- `app/src/components/dnd/__tests__/collision.test.ts` (+4, single-row day)

The Bug 1 and Bug 3 tests were each confirmed to fail when their fix is reverted,
reproducing the reported symptom exactly (`AUG 06 THU` for Bug 1;
`parentTaskId: null` under an indent preview for Bug 3).

`app/src/components/__tests__/TaskList.dragTarget.test.tsx` had a case asserting
the drop area was *absent* before a drag — the behaviour that caused Bug 2. It
now asserts the opposite, with the reason recorded on the test.

One API test (`sessionService > carries an explicit lifetime…`) fails, on this
branch and on its base commit alike; it is unrelated to these changes.
