import { PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Marks a subtree as never initiating a pointer drag. Put it on checkboxes,
 * inputs, menus, task controls and habit day cells - anything whose own press
 * gesture would otherwise be swallowed by the row's drag.
 */
export const NO_DRAG_ATTR = 'data-no-drag';

/** Marks the element that starts a keyboard drag. */
export const DRAG_HANDLE_ATTR = 'data-drag-handle';

function isWithin(target: EventTarget | null, attr: string): boolean {
  return target instanceof HTMLElement && target.closest(`[${attr}]`) !== null;
}

/**
 * Press-and-move pointer drag.
 *
 * Distance-based, not delay-based: a drag only activates once the pointer has
 * actually travelled PRESS_ACTIVATION.distance while pressed, however long the
 * press is held. A stationary press - however long a deliberate click happens
 * to take, commonly well past 100ms for a real hand on a real mouse - never
 * activates, so it never competes with the row's own click handler.
 *
 * A delay-based constraint was tried first (hold N ms, regardless of movement,
 * to start a drag), but it made every click that happened to be held past the
 * delay activate dnd-kit's real drag lifecycle - complete with collision
 * detection landing on whatever the pointer was nearest, which for a click
 * held on the last row of a list could resolve to the day/collection
 * *container* rather than the row itself. dnd-kit's own click-suppression
 * (stopPropagation on the next document click, see AbstractPointerSensor
 * .handleStart in @dnd-kit/core) then ate the click that would have selected
 * the row, while the drag lifecycle it left running could still resolve to a
 * real, unintended move. Gating on movement instead of time removes the
 * ambiguity at the source: no movement, no drag, ever.
 *
 * dnd-kit doesn't call preventDefault() until a drag is fully activated (see
 * handleMove in @dnd-kit/core), so the browser's own scroll-gesture recognizer
 * still gets first look at any touchmove exactly as before - this constraint
 * changes when a drag activates, not that. Whole-row dragging is safe on a
 * mouse (there's no competing native gesture) but not on touch/pen, so those
 * are scoped to the handle, which is kept always visible and non-scrolling for
 * them - see the `(hover: none), (pointer: coarse)` rule for `.drag-handle` in
 * index.css.
 */
export class PlannerPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent) => {
        // Only the primary button drags; right-click opens context menus.
        if (!event.isPrimary || event.button !== 0) return false;
        if (isWithin(event.target, NO_DRAG_ATTR)) return false;
        return true;
      },
    },
  ];
}

/**
 * Keyboard drag, startable from task row or handle.
 */
export class PlannerKeyboardSensor extends KeyboardSensor {
  static activators = [
    {
      eventName: 'onKeyDown' as const,
      handler: ({ nativeEvent: event }: ReactKeyboardEvent) => {
        if (event.key !== ' ' && event.key !== 'Enter') return false;
        return isWithin(event.target, DRAG_HANDLE_ATTR);
      },
    },
  ];
}

/** Distance-based activation shared by every pointer drag in the app. */
export const PRESS_ACTIVATION = { distance: 6 } as const;
