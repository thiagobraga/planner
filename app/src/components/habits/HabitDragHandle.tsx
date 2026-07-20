import { DRAG_HANDLE_ATTR } from '../dnd/sensors';

/**
 * The keyboard activator for a habit drag, and the hover affordance on rows.
 *
 * Carries no listeners of its own: dnd-kit's keydown listener is already spread
 * onto the row, and the keyboard sensor only asks whether the event target sits
 * inside a `[data-drag-handle]`. Mirrors `TaskItem`'s handle so both entity
 * kinds are picked up the same way.
 */
export function HabitDragHandle({
  label,
  className = 'absolute left-[-18px] w-4',
}: {
  /** The habit or group name; announced as the target of the reorder. */
  label: string;
  /** Placement, which differs between a row gutter and a card corner. */
  className?: string;
}) {
  return (
    <span
      {...{ [DRAG_HANDLE_ATTR]: '' }}
      tabIndex={0}
      role="button"
      aria-label={`Reorder ${label}`}
      className={`drag-handle ${className} flex cursor-grab select-none items-center justify-center text-[10px] text-ink-light opacity-0`}
    >
      ⠿
    </span>
  );
}
