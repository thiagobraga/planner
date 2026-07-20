import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragEndEvent,
  type Announcements,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  PlannerPointerSensor,
  PlannerKeyboardSensor,
  PRESS_ACTIVATION,
} from '../components/dnd/sensors';
import { plannerCollisionDetection } from '../components/dnd/collision';
import { createIndentTracker } from '../utils/dragIndent';
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

interface PlannerDragContextValue {
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
  /** The droppable currently under the pointer, for positioning the indicator. */
  overId: string | null;
  /** Speak a message through the shared live region. */
  announce: (message: string) => void;
  registerHandlers: (kind: DragKind, handlers: DragHandlers) => () => void;
}

const PlannerDragContext = createContext<PlannerDragContextValue | null>(null);

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
export function usePlannerDragHandlers(kind: DragKind, handlers: DragHandlers): void {
  const { registerHandlers } = usePlannerDrag();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    return registerHandlers(kind, {
      onDragStart: (e) => ref.current.onDragStart?.(e),
      onDragMove: (e) => ref.current.onDragMove?.(e),
      onDragOver: (e) => ref.current.onDragOver?.(e),
      onDragEnd: (e) => ref.current.onDragEnd?.(e),
      onDragCancel: () => ref.current.onDragCancel?.(),
    });
  }, [kind, registerHandlers]);
}

/**
 * The app's single DndContext, wrapping both the Sidebar and the routed page.
 *
 * It has to live above both: dragging a task onto a sidebar collection crosses
 * from the page into the nav, and a drop can only be seen by a context that
 * contains both ends of the gesture. Nested contexts inside TaskList and
 * CollectionTreeNav made that drop invisible, so they are removed in favour of
 * plain SortableContexts registered under this one.
 *
 * The provider owns lifecycle, presentation and announcements; it knows nothing
 * about what a move *means*. Each page registers handlers for its own entity
 * kind and receives only the events matching that kind.
 */
/**
 * Suppress dnd-kit's built-in live region.
 *
 * Its defaults speak in raw ids - "Draggable item 4343b20a-… was moved over
 * droppable area 2ffc167d-…" - which is noise at best and unusable for a screen
 * reader user at worst. Returning undefined from every handler leaves the
 * provider's own region below as the single, human-readable voice; the entity
 * hooks phrase those messages because only they know what a row *is*.
 */
/**
 * Auto-scroll, narrowed.
 *
 * dnd-kit scrolls whenever the *dragged rect* sits inside a threshold band at a
 * scroll edge - 20% of the viewport by default, and re-evaluated every frame
 * regardless of whether the pointer has moved. Pressing a row that happened to
 * be near the top or bottom of the window therefore scrolled the page on its
 * own, for as long as the press was held.
 *
 * The band is tightened to 8%, and horizontal scrolling is switched off
 * entirely: sideways movement means nesting here, never travel.
 */
const AUTO_SCROLL = { threshold: { x: 0, y: 0.08 } } as const;

const SILENT_ANNOUNCEMENTS: Announcements = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

export function PlannerDragProvider({ children }: { children: ReactNode }) {
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [overlay, setOverlay] = useState<DragOverlayInfo | null>(null);
  const [overlayNode, setOverlayNode] = useState<ReactNode | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [indentSteps, setIndentSteps] = useState(0);
  const [overId, setOverId] = useState<string | null>(null);
  const handlersRef = useRef(new Map<DragKind, DragHandlers>());
  /** Nesting intent, rebased per row so drift cannot accumulate into a preview. */
  const indent = useRef(createIndentTracker());
  /** Mirrors overId for comparison outside a state updater. */
  const overIdRef = useRef<string | null>(null);
  /** Whatever held focus when the drag began, so the drop can hand it back. */
  const focusOrigin = useRef<HTMLElement | null>(null);

  const registerHandlers = useCallback((kind: DragKind, handlers: DragHandlers) => {
    handlersRef.current.set(kind, handlers);
    return () => {
      // Only clear if this registration is still the live one; a route change can
      // mount the next page before the previous one unmounts.
      if (handlersRef.current.get(kind) === handlers) handlersRef.current.delete(kind);
    };
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  /** Route an event to whichever page registered the kind being dragged. */
  const dispatch = useCallback(
    <E extends { active: { data: { current?: unknown } } }>(
      event: E,
      pick: (h: DragHandlers) => ((event: E) => void) | undefined,
    ) => {
      const data = event.active.data.current as DragData | undefined;
      if (!data) return;
      const handlers = handlersRef.current.get(data.kind);
      pick(handlers ?? {})?.(event);
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as DragData | undefined;
      focusOrigin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveDrag(data ?? null);
      dispatch(event, (h) => h.onDragStart);
    },
    [dispatch],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (event.delta.x !== 0 || event.delta.y !== 0) setHasMoved(true);
      indent.current.move(event.delta.x);
      const steps = Math.round(indent.current.offset() / INDENT_PX);
      setIndentSteps((prev) => (prev === steps ? prev : steps));
      dispatch(event, (h) => h.onDragMove);
    },
    [dispatch],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const next = event.over ? String(event.over.id) : null;
      if (next !== overIdRef.current) {
        overIdRef.current = next;
        // Same rebasing the move hooks apply: nesting intent is measured from
        // the row the pointer is on, so the preview shows the depth a drop will
        // actually produce rather than one drift accumulated on the way here.
        indent.current.enterRow();
        setIndentSteps(Math.round(indent.current.offset() / INDENT_PX));
        setOverId(next);
      }
      dispatch(event, (h) => h.onDragOver);
    },
    [dispatch],
  );

  /**
   * Hand focus back to where the drag started, without scrolling.
   *
   * dnd-kit does this itself, but with a bare `.focus()`, and focusing an
   * element the browser considers off-position scrolls it into view - so
   * releasing a drag jumped the page. Keyboard users still need the focus back
   * (that is how they carry on after a drop), so this restores it deliberately
   * with `preventScroll` and dnd-kit's own pass is turned off below.
   */
  const restoreFocus = useCallback(() => {
    const element = focusOrigin.current;
    focusOrigin.current = null;
    if (!element) return;
    // After the drop has been applied, so the row is not focused mid-reorder.
    requestAnimationFrame(() => {
      if (element.isConnected) element.focus({ preventScroll: true });
    });
  }, []);

  const reset = useCallback(() => {
    restoreFocus();
    indent.current.reset();
    overIdRef.current = null;
    setActiveDrag(null);
    setOverlay(null);
    setOverlayNode(null);
    setHasMoved(false);
    setIndentSteps(0);
    setOverId(null);
  }, [restoreFocus]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      dispatch(event, (h) => h.onDragEnd);
      reset();
    },
    [dispatch, reset],
  );

  const handleDragCancel = useCallback(() => {
    handlersRef.current.forEach((h) => h.onDragCancel?.());
    setAnnouncement('Move cancelled.');
    reset();
  }, [reset]);

  const sensors = useSensors(
    useSensor(PlannerPointerSensor, { activationConstraint: PRESS_ACTIVATION }),
    useSensor(PlannerKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const value = useMemo<PlannerDragContextValue>(
    () => ({
      activeDrag,
      overlay,
      setOverlay,
      overlayNode,
      setOverlayNode,
      hasMoved,
      indentSteps,
      overId,
      announce,
      registerHandlers,
    }),
    [activeDrag, overlay, overlayNode, hasMoved, indentSteps, overId, announce, registerHandlers],
  );

  return (
    <PlannerDragContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={plannerCollisionDetection}
        autoScroll={AUTO_SCROLL}
        accessibility={{ announcements: SILENT_ANNOUNCEMENTS, restoreFocus: false }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/*
          Rendered here rather than inside a list, because the lists it drags out
          of are `overflow-y-auto` and would clip the floating item at their edge.
        */}
        <DragOverlay dropAnimation={null}>
          {/*
            The rows themselves travel when the owning list provides them, so
            what moves under the pointer is the block being moved rather than a
            label describing it - the shape of a parent carrying children is
            legible at a glance. The chip remains for drags no list claims.
          */}
          {overlayNode ? (
            <div className="planner-drag-overlay planner-drag-overlay--block">{overlayNode}</div>
          ) : overlay ? (
            <div className="planner-drag-overlay flex items-center gap-2 rounded-[8px] border border-dot bg-cream px-2 py-1 text-[13px] text-ink shadow-[0_4px_16px_rgba(44,44,44,0.18)]">
              <span className="planner-drag-overlay-title truncate max-w-[280px]">
                {overlay.title}
              </span>
              {overlay.descendantCount > 0 && (
                <span className="planner-drag-overlay-count text-[11px] text-ink-light">
                  +{overlay.descendantCount}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/*
        Single live region for every drag. Pickup, projected target, rejection,
        drop and cancel all speak through here so a screen-reader user follows the
        move without seeing the overlay.
      */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </PlannerDragContext.Provider>
  );
}
