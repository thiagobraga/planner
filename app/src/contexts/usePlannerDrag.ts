import { createContext, useContext, useEffect, useRef } from 'react';
import type {
  DragHandlers,
  DragKind,
  PlannerDragContextValue,
} from '../types/drag';

/** The page grid. One indent step of horizontal drag equals one nesting level. */
export const INDENT_PX = 24;

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
