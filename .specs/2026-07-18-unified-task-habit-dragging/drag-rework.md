# Drag rework — what is needed

Written 2026-07-19, after browser acceptance testing and a screen recording of
the failure. Covers one behavioural defect and four visual changes. Nothing
here is implemented yet.

## 1. Accidental nesting (defect, highest priority)

### Symptom

Dragging a task across dates parents it under an unrelated row. In the
recording: a top-level parent with two children landed as a child of
`Quetiapina`, itself a completed subtask, putting the subtree at depth 3.
Reproduced twice more in the same recording with different tasks.

### Cause

`app/src/utils/taskProjection.ts:178`

```ts
const dragDepth = block[0]!.depth + Math.round(offsetX / INDENT_WIDTH);
```

`offsetX` is `event.delta.x` — total horizontal travel since pointer-down, not
intent expressed near the drop point. A long vertical drag drifts sideways as a
side effect; ~90px of drift requests four nesting levels. The row above then
grants as much as its own depth permits.

Measured against `resolveMove`, dropping onto the same row:

| offsetX | over | parent | depth |
|---|---|---|---|
| 0 | `quetiapina` | `comprar` | 1 |
| 240 | `quetiapina` | `quetiapina` | 2 |
| 240 | `duloxetina` | `duloxetina` | 2 |

Severity scales with drag distance, which is why cross-date drags are the worst
case.

### Not the cause

An earlier diagnosis blamed Daily flattening every date into one list, letting
the projection inherit an ancestor across the date boundary. A fix for that
produced byte-identical output and was reverted. Depth scoping is not the
problem; horizontal accumulation is.

### Decision required

- **A. Absolute position** — derive depth from pointer x relative to the target
  list's left edge, not from accumulated delta. Depth becomes something aimed
  at rather than accumulated. Preferred; pairs with §2.4.
- **B. Deadband** — ignore horizontal intent below a threshold, requiring
  deliberate sideways movement. Smaller change, keeps the drift model.
- **C. Clamp cross-day drops to depth 0** — a drop onto a new date always lands
  top-level; indent afterward. Narrowest fix, does not help same-day drags.

A and C are compatible.

## 2. Drag visuals

### 2.1 Start in place

Pressing and holding must not move anything. Today the row and its descendants
are pulled out of the list on pickup (`TaskList.tsx`, the `carried` set), so the
list reflows before the pointer has moved.

### 2.2 Move the real block

The floating overlay (`DragOverlay` in `PlannerDragContext.tsx`) is a separate
element showing title + `+N`. It should be the actual task block that travels,
so the shape being moved is legible — particularly a parent carrying children.

### 2.3 Drop the destination wash

`.task-list--drop-target` (`index.css:304`) tints and outlines the whole
destination day. Remove it; the placeholder in §2.4 carries the signal.

### 2.4 Placeholder showing landing position and indent

Replace the current 2px accent line (`.task-list-insertion`) with a placeholder
that occupies the landing slot **at the destination indent level**, so the depth
a drop will produce is visible before releasing. This is what makes §1 legible
rather than a surprise after the fact.

## 3. Verification

- Reproduce §1 in a test that fails before the fix and passes after. The last
  attempt at this produced tests that passed either way; a red-first run is the
  acceptance bar.
- Cover: same-day reorder, same-day reparent, cross-date drop, parent carrying
  children, and a long vertical drag with incidental horizontal drift.
- Browser check against `dev / planner / test`, plus scratch tasks on Daily.
  Not against real task data.

## 4. Related state

Already fixed and committed:

- Live-region announcements; dnd-kit's default UUID announcements suppressed
  (`131805a`)
- Cross-date drop indicator, and the `findIndex` → `-1` → clamped-to-0 bug that
  previewed a row jumping to the top of its own day (`09fe646`)
- Indent rendered from the walked row depth rather than global tree depth, so an
  orphaned row no longer draws a level with nothing above it (`09fe646`)
- Test fixture types; `HEAD` had been failing `tsc` while vitest stayed green
  (`5388813`)

Data restored 2026-07-19: `Faxina na cozinha`, `Organizar remédios Thi` and
`Organizar remédios Meg` had parents or dates rewritten by this defect. Zero
cross-date parent links remain.

Deferred separately: Phase 12, manual sidebar collapse/expand with persisted
state, which supersedes the mobile edge-open dropped from Phase 6.
