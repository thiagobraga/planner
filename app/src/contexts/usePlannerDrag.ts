import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type {
  DragStartEvent,
  DragMoveEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import type { DragData, DragKind } from '../types/drag';

/** The page grid. One indent step of horizontal drag equals one nesting level. */
export const INDENT_PX = 24;

export interface DragHandlers {
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
}

/** What the floating overlay shows while a drag is in flight. */
export interface DragOverlayInfo {
  title: string;
  /** Descendants carried along, so the overlay can say "+3". */
  descendantCount: number;
}

export interface PlannerDragContextValue {
  activeDrag: DragData | null;
  overlay: DragOverlayInfo | null;
  setOverlay: (info: DragOverlayInfo | null) => void;
  /**
   * The rows being dragged, rendered by whichever list owns them.
   *
   * The provider cannot build this itself - it knows a drag is in flight but
   * nothing about what a task row looks like - so the owning list hands it up.
   * Falls back to a title chip when no list has claimed the drag.
   */
  overlayNode: ReactNode | null;
  setOverlayNode: (node: ReactNode | null) => void;
  /**
   * False until the pointer actually travels. Lets a list hold its layout
   * completely still on pickup: pressing a row must not reflow anything until
   * the user has expressed movement.
   */
  hasMoved: boolean;
  /**
   * Horizontal drag distance, quantised to whole indent steps.
   *
   * Quantised rather than raw so lists re-render only when the projected
   * nesting level actually changes, instead of on every pointer move.
   */
  indentSteps: number;
  /**
   * The same nesting intent as `indentSteps`, readable synchronously.
   *
   * The preview renders from `indentSteps` (React state) while a drop commits
   * from a ref read inside `onDragEnd`. When those came from two separately
   * instantiated `IndentTracker`s - one here, one in `useTaskDrag` - they were
   * two pieces of mutable state with no shared source of truth, and they
   * disagreed: the list previewed a row nesting under its sibling while the
   * committed move sent `parentTaskId: null`. Reading both from this one
   * tracker makes that divergence structurally impossible rather than merely
   * unlikely.
   *
   * A function rather than a value so callers get the live offset at the moment
   * they ask, not whatever was current when the context value was memoised.
   */
  indentOffset: () => number;
  /** The droppable currently under the pointer, for positioning the indicator. */
  overId: string | null;
  /** Speak a message through the shared live region. */
  announce: (message: string) => void;
  registerHandlers: (kind: DragKind, handlers: DragHandlers) => () => void;
  setAutoScrollAxis: (axis: 'horizontal' | 'vertical') => void;
}

export const PlannerDragContext = createContext<PlannerDragContextValue | null>(null);

export function usePlannerDrag(): PlannerDragContextValue {
  const ctx = useContext(PlannerDragContext);
  if (!ctx) throw new Error('usePlannerDrag must be used inside PlannerDragProvider');
  return ctx;
}

/**
 * Registers this component's drag handlers for one entity kind, for as long as
 * it is mounted. The currently routed page claims 'task' or 'habit'; the sidebar
 * claims 'collection'. Handlers are held in a ref, so a component may pass fresh
 * closures every render without re-registering.
 */
export function usePlannerDragHandlers(
  kind: DragKind,
  handlers: DragHandlers,
  options: { enabled?: boolean } = {},
): void {
  const { registerHandlers } = usePlannerDrag();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (options.enabled === false) return;
    return registerHandlers(kind, {
      onDragStart: (e) => ref.current.onDragStart?.(e),
      onDragMove: (e) => ref.current.onDragMove?.(e),
      onDragOver: (e) => ref.current.onDragOver?.(e),
      onDragEnd: (e) => ref.current.onDragEnd?.(e),
      onDragCancel: () => ref.current.onDragCancel?.(),
    });
  }, [kind, options.enabled, registerHandlers]);
}
