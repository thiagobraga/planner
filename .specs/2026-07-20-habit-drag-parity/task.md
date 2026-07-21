# Habit drag parity — tasks

Source plan: `plan.md` (6 gaps closing habit-vs-task drag parity).

Markers: `[ ]` not started · `[~]` in progress · `[x]` done

## Step 1 — `useHabitDrag.ts` correctness (gaps 1 + 5)

- [x] Gap 1: import `createIndentTracker` from `../utils/dragIndent`
- [x] Gap 1: add `indent` + `overRowId` refs
- [x] Gap 1: reset tracker in `handleDragStart`
- [x] Gap 1: `handleDragMove` uses `indent.current.move(...)` / `.offset()`
- [x] Gap 1: `handleDragOver` rebases via `enterRow()` on row change
- [x] Gap 5: `temp-` guard in `handleHabitDrop` (after `habitSnapshot.current = null`)
- [x] Gap 5: `temp-` guard in `handleGroupDrop` (before `trackMove`, so no `untrack()` needed)
- [x] Tests: drift/rebase scenario in `useHabitDrag.test.tsx`
- [x] Tests: temp-id habit + temp-id group cases (no API call, no optimistic update)

## Step 2 — handle markup, cursor CSS, reduced motion (gaps 3 + 4 + 6)

- [x] Gap 3: `DRAG_HANDLE_ATTR` handle in `SortableHabitLabelRow` (Timeline)
- [x] Gap 3: handle in `SortableGroupHeader` (Timeline)
- [x] Gap 3: handle in `SortableGroupHeading` (Calendar)
- [x] Gap 3: small corner handle in `SortableHabitCard` (Calendar) — keyboard target only, whole-card pointer drag unchanged
- [x] Gap 4: row-level `aria-label` on all 4 outer elements
- [x] Gap 4: cursor/hover/focus-visible CSS block in `index.css` after `.task-item`
- [x] Gap 6: extend `prefers-reduced-motion` block with the 4 habit selectors
- [x] Tests: each of 4 components exposes `[data-drag-handle]` with `aria-label="Reorder …"`

## Step 3 — `HabitBlockPreview` (gap 2)

- [x] New `app/src/components/HabitBlockPreview.tsx` (`{ name, count, kind }`)
- [x] Wire via `setOverlayNode` in `HabitTimeline.tsx`
- [x] Wire via `setOverlayNode` in `HabitCalendar.tsx`
- [x] Tests: `HabitBlockPreview.test.tsx` — both kinds, count 0 and >0

## Defects found after the parity pass (2026-07-21)

- [x] Habit move and rename returned habits with an empty `completions` list, so
      the client merge blanked every filled day until a reload
- [x] The habit section always beat the rows inside it in collision detection:
      `containerIdOf` had no answer for habit rows or sections, so `inside` was
      always empty. Every habit drop resolved as "append to section" — depth 0,
      end of list — which is why nesting never previewed and the drop position
      was ignored

## Verification

- [x] `docker compose exec app npm run lint` — no new errors (12 pre-existing)
- [x] `docker compose exec app npm test` — 579 passed; api 563 passed
- [ ] Manual browser check, steps 1-8 in `plan.md` § Verification
