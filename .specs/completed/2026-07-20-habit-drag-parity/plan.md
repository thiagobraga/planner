# Habit drag parity with task drag

## Context

Task dragging and habit dragging in Planner already share one drag engine — a single `DndContext` (`PlannerDragContext.tsx`), the same custom sensors (`sensors.ts`, 120ms press-hold), the same collision detection (`collision.ts`), and one discriminated `DragData` union (`types/drag.ts`). Habit move/reorder is functionally implemented and tested end-to-end (backend `moveHabit`/`moveHabitGroup`, frontend `useHabitDrag`, `habitProjection.ts`). But direct comparison against the task implementation (`useTaskDrag.ts`, `TaskItem.tsx`, `TaskList.tsx`, `TaskBlockPreview.tsx`) surfaced 6 concrete places where habit dragging doesn't yet behave like task dragging — including one that's an outright bug (keyboard drag is currently unreachable for habits) and one latent correctness gap (indent drift isn't rebased, so a long habit drag can misread sideways drift as nesting intent the way task drag used to before it was fixed). The user wants full parity: same projection behavior, same cursor/handle affordance, same visual/interaction polish — confirmed in scope: all 6 gaps, a real `HabitBlockPreview` component (not just a nicer fallback chip), keep habit's existing insertion-line+dim visual language (habit rows sit in a 2-column day-grid where dnd-kit's slide-transform would desync the day cells — this is correct as-is, not a bug), and leave Calendar mode's sub-habit-drag restriction untouched (documented, intentional).

Verified directly against source (not just the exploration agents' report): `useHabitDrag.ts:104` (`offsetX.current = event.delta.x`, unrebased), `useTaskDrag.ts:65-66,95-96,117-122` (the `createIndentTracker` rebase pattern to mirror), `sensors.ts:48-57` (`PlannerKeyboardSensor` requires `data-drag-handle` in the event target's ancestry — absent from all 4 habit row/card/header variants), `index.css:248-272` (`.task-item` cursor/hover/handle-reveal CSS, `386-390` reduced-motion), `TaskItem.tsx:258-294` (handle markup + row `aria-label` pattern to mirror), `HabitTimeline.tsx:668-744` (`SortableHabitLabelRow`, `SortableGroupHeader` — confirmed class names `habit-timeline-row-label`, `habit-timeline-group-header`), `HabitCalendar.tsx:164-289` (`SortableGroupHeading`, `SortableHabitCard` — confirmed class names `habit-calendar-group-name`, `habit-calendar-item`; note the explicit comment at `HabitCalendar.tsx:253-256`: *"A whole card is the drag affordance here, rather than a handle: there is no row to grab"* — a deliberate choice for Calendar's pointer-drag UX that the keyboard-handle addition must respect, not override).

## Gaps and fixes

### 1. Indent drift not rebased (`useHabitDrag.ts`)

Mirror `useTaskDrag.ts`'s pattern exactly:
- Import `createIndentTracker` from `../utils/dragIndent`.
- Add `const indent = useRef(createIndentTracker()); const overRowId = useRef<string | null>(null);`
- In `handleDragStart`: after `offsetX.current = 0;` add `indent.current.reset(); overRowId.current = null;`
- Replace `handleDragMove` body with `indent.current.move(event.delta.x); offsetX.current = indent.current.offset();`
- In `handleDragOver`, right after the `if (!active) return;` guard, rebase on row change:
  ```ts
  const overRow = event.over ? String(event.over.id) : null;
  if (overRow !== overRowId.current) {
    overRowId.current = overRow;
    indent.current.enterRow();
    offsetX.current = indent.current.offset();
  }
  ```
- `rowProjection`/`handleHabitDrop` keep reading `offsetX.current` unchanged — same shape, just rebased now.

**Tests**: extend `useHabitDrag.test.tsx` with a drift scenario mirroring whatever pattern `useTaskDrag`'s nesting test uses (large cumulative `delta.x` across several `onDragMove` calls, row changes via `onDragOver`, small residual drift at drop) — assert the final `apiMoveHabit` call's `parentId` reflects the row actually hovered at drop, not the accumulated drift.

### 2. No `HabitBlockPreview` (generic chip fallback shown instead)

New file `app/src/components/HabitBlockPreview.tsx`: a small presentational component taking `{ name, count, kind: 'habit' | 'habit-group' }`, styled to resemble the actual row (dot marker + name for `'habit'`, uppercase heading style for `'habit-group'`, `+N` badge when count > 0) — pull exact classes from `HabitTimeline.tsx`'s row markup (`habit-timeline-row-label`'s dot/name spans) and `SortableGroupHeader`'s heading text classes, the same way `TaskBlockPreview.tsx` mirrors `TaskItem.tsx`.

Wire via `setOverlayNode` (from `usePlannerDrag()`) in both `HabitTimeline.tsx` and `HabitCalendar.tsx`: derive the dragged habit/group from `activeDragId` and the already-available `sections`/`dragRows`, push a `<HabitBlockPreview .../>` in a `useEffect` keyed on the dragged id (not gated on `hasMoved`, matching `TaskList.tsx`'s reasoning — avoids the chip flashing on pickup), clear on unmount/id-change. Since Timeline and Calendar are never both mounted, no conflict over `setOverlayNode`.

Leave `useHabitDrag.ts`'s existing `setOverlay({ title, descendantCount })` untouched — same dual-provide pattern task drag already uses (hook sets plain-data fallback, the mounted list overrides with a real node).

**Tests**: new `HabitBlockPreview.test.tsx` (render both `kind` variants, count 0 and >0, assert marker/name/badge). Check for an existing `TaskBlockPreview.test.tsx` first and mirror its assertion style.

### 3. No `data-drag-handle` — keyboard drag is currently dead for habits

Add a handle element carrying `DRAG_HANDLE_ATTR` (from `../dnd/sensors`) to all 4 variants. It needs no separate `listeners` — dnd-kit's keydown listener is already bound on the row/card (via the spread `{...listeners}`), and `PlannerKeyboardSensor` reads `event.target`, so a nested handle satisfies `closest('[data-drag-handle]')` without extra wiring. Mirror `TaskItem.tsx:286-294`'s handle (`tabIndex`, `role="button"`, `aria-label`).

- **`SortableHabitLabelRow`** (`HabitTimeline.tsx`) and **`SortableGroupHeader`** (`HabitTimeline.tsx`): rows have natural left gutter from `depth * indent` padding — add a handle positioned like `TaskItem`'s (`absolute left-[-18px]`), `aria-label={`Reorder ${node.name}`}` / `${group.name}`.
- **`SortableGroupHeading`** (`HabitCalendar.tsx`): same pattern, `aria-label={`Reorder ${group.name}`}`.
- **`SortableHabitCard`** (`HabitCalendar.tsx`): respect the existing "whole card is the affordance, not a handle" design (`HabitCalendar.tsx:253-256`) — don't add a full left-edge handle strip that visually competes with the card. Add a small corner-positioned handle (e.g. top-right, sized to fit the grid's `gap-6` gutter) purely as the keyboard-activation target; it doesn't need to be the primary visual affordance since pointer-drag already works card-wide. `aria-label={`Reorder ${node.name}`}`.

Import `DRAG_HANDLE_ATTR` in both files (currently only `NO_DRAG_ATTR` is imported).

**Tests**: render each of the 4 components, assert an element with `[data-drag-handle]` and correct `aria-label` exists. A true keyboard-drag end-to-end test is impractical in jsdom (dnd-kit's keyboard coordinate getter needs real layout) — cover the actual pickup/move behavior in the manual browser check instead.

### 4. No cursor CSS / row `aria-label`

Row-level `aria-label` (separate from the handle's "Reorder ..." label — mirrors `TaskItem`'s dual-label: row announces the item, handle announces the action): add `aria-label={node.name}` / `{group.name}` to each of the 4 outer elements (same edit pass as gap 3).

CSS in `app/src/index.css`, added right after the existing `.task-item` block (~line 272), reusing the same `.drag-handle` class name already used by the new handle spans so only the selector list needs extending:

```css
.habit-timeline-row-label,
.habit-timeline-group-header,
.habit-calendar-item,
.habit-calendar-group-name {
  position: relative;
  cursor: pointer;
  transition: opacity 150ms;

  &:hover .drag-handle {
    opacity: 0.5 !important;
  }

  &:focus-visible {
    outline: 2px solid var(--color-ink);
    outline-offset: -2px;
    border-radius: 4px;
  }
}
```

Deliberately no background-wash `:hover` (task-item has one) unless that's wanted too — flagged as a follow-up, not required for this parity pass.

**Tests**: not unit-testable; cover in manual browser check.

### 5. No `temp-` ID guard (dragging a not-yet-synced habit/group)

Mirror `useTaskDrag.ts:173-176`. In `handleHabitDrop`, right after `habitSnapshot.current = null;`:
```ts
if (active.habitId.startsWith('temp-')) {
  announce('This habit is still being created. Try again in a moment.');
  return;
}
```
In `handleGroupDrop`, right after `groupSnapshot.current = null;` — but note `handleGroupDrop` already has an early-out pattern (`if (from === -1 || ...) { untrack(); return; }`) that calls `untrack()` before returning once `trackMove` has been invoked. Place the temp-ID check **before** `trackMove` is called (i.e., immediately after `groupSnapshot.current = null;`, before `const untrack = trackMove(...)`) so there's nothing to untrack yet — no extra `untrack()` call needed there.

**Tests**: two new cases in `useHabitDrag.test.tsx` — dragging a `temp-habit-*` id and a `temp-*` group id, asserting `apiMoveHabit`/`apiMoveHabitGroup` are never called and no optimistic `setHabits`/`setGroups` update happens.

### 6. No reduced-motion carve-out

Extend the existing block in `index.css` (~line 386) once gap 4's CSS (which introduces `transition: opacity 150ms` on the habit classes) is in place:
```css
@media (prefers-reduced-motion: reduce) {
  .task-item,
  .habit-timeline-row-label,
  .habit-timeline-group-header,
  .habit-calendar-item,
  .habit-calendar-group-name {
    transition: none !important;
  }
}
```

## Implementation order

1. **Gap 1 + Gap 5** together — both are self-contained edits to `useHabitDrag.ts`, do in one pass. Gap 1 is the highest-value fix (silent correctness bug); Gap 5 is small and adjacent.
2. **Gap 3 + Gap 4 + Gap 6** together — all land in the same two files (`HabitTimeline.tsx`, `HabitCalendar.tsx`) plus `index.css`; do handle markup (3), then its CSS + aria-labels (4), then the reduced-motion extension (6) which depends on 4's selectors existing.
3. **Gap 2** (`HabitBlockPreview`) — independent; build the component first, then wire into the same two files touched in step 2 (one more pass, or fold into step 2 if convenient).

## Critical files

- `app/src/hooks/useHabitDrag.ts` — gaps 1, 5
- `app/src/components/habits/HabitTimeline.tsx` — gaps 2, 3, 4
- `app/src/components/habits/HabitCalendar.tsx` — gaps 2, 3, 4
- `app/src/components/HabitBlockPreview.tsx` (new) — gap 2
- `app/src/index.css` — gaps 4, 6
- `app/src/hooks/__tests__/useHabitDrag.test.tsx` — tests for gaps 1, 5
- New `app/src/components/__tests__/HabitBlockPreview.test.tsx` — gap 2
- Reference only (don't modify): `app/src/hooks/useTaskDrag.ts`, `app/src/components/TaskItem.tsx`, `app/src/components/TaskBlockPreview.tsx`, `app/src/components/dnd/sensors.ts`, `app/src/utils/dragIndent.ts`

## Verification

- `docker compose exec app npm run lint`
- `docker compose exec app npm test` — full suite; specifically confirm `useHabitDrag.test.tsx`, `habitProjection.test.ts`, `dragIndent.test.ts`, and all `useTaskDrag*.test.ts(x)` (regression check — shared files like `sensors.ts`/`dragIndent.ts` aren't modified, but confirm nothing habit-scoped leaked into task behavior) still pass.
- Manual browser check (dev server + chrome-devtools MCP tools), Habits page:
  1. Timeline view: `take_snapshot` to confirm each row/group header now exposes an accessible handle (`aria-label="Reorder ..."`).
  2. `hover` a habit row → screenshot: cursor is `pointer`, handle fades in at the row's left edge, not clipped.
  3. Keyboard drag: focus a handle, `Space` to pick up, `ArrowDown` to move, `Space` to drop — confirm the row actually reordered (previously impossible) and the announce region spoke the placement.
  4. Pointer-drag a habit with sub-habits and a group: confirm the overlay now shows `HabitBlockPreview` (dot/name/+N or uppercase heading/+N), not the old plain chip.
  5. Repeat 2-4 in Calendar view for `SortableHabitCard`/`SortableGroupHeading` — for the card, confirm the small keyboard handle doesn't visually clutter the card and whole-card pointer-drag still works unchanged.
  6. Drift check (gap 1): a slow, long diagonal drag (well down the list with sideways wobble) that ends with no further horizontal movement over the target row should land at the depth actually gestured at the final row, not one implied by the accumulated drift on the way there.
  7. `emulate({ reducedMotion: 'reduce' })`, repeat step 2 — confirm no opacity transition animates.
  8. `list_console_messages` throughout — check for React key warnings or dnd-kit warnings from the new handle spans/overlay wiring.
