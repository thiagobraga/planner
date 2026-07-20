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
 * Press-and-hold pointer drag.
 *
 * The 120ms delay is what lets a row be both tappable and draggable: a quick tap
 * never becomes a drag, so single clicks and double-taps stay intact. The 8px
 * tolerance is what keeps the page scrollable - moving more than 8px before the
 * delay elapses cancels the pending drag and hands the gesture back to the
 * browser, rather than blocking the scroll while waiting.
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
 * Keyboard drag, startable only from the dedicated handle.
 *
 * Scoping it to the handle is what keeps Space free to toggle a task while the
 * row itself has focus - dnd-kit's default keyboard activator would otherwise
 * claim that key for picking the row up.
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

/** Press-and-hold constraint shared by every pointer drag in the app. */
export const PRESS_ACTIVATION = { delay: 120, tolerance: 8 } as const;
