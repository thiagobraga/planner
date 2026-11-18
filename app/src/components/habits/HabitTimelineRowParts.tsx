import { MoreHorizontal } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { HabitDragHandle } from './HabitDragHandle';
import { containerForGroup } from '../../utils/habitProjection';
import type { HabitDragData, HabitGroupDragData, HabitSectionDropData } from '../../types/drag';
import type {
  SortableGroupHeaderProps,
  SortableHabitLabelRowProps,
  TimelineSectionDropProps,
} from '../../types/habitTimeline';

/**
 * One drop region of the label column - the ungrouped list, or one group.
 *
 * Registered even when it holds no habits, because an empty group has no row to
 * aim at and would otherwise be unreachable by drag.
 */
export function TimelineSectionDrop({
  groupId,
  droppable,
  children,
}: TimelineSectionDropProps) {
  const data: HabitSectionDropData = { kind: 'habit-section', groupId };
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${containerForGroup(groupId)}`,
    data,
    disabled: !droppable,
  });

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      data-drop-target={isOver ? 'true' : undefined}
      className={`habit-timeline-section ${isOver ? 'habit-timeline-section--drop-target' : ''}`}
    >
      {children}
    </div>
  );
}

/**
 * A habit label row, draggable through the shared context.
 *
 * Deliberately does not apply dnd-kit's transform. The timeline is two columns
 * driven by one row list, and only this column would move - the day cells would
 * slide out of step with their own habit. The insertion line previews the
 * landing position instead.
 */
export function SortableHabitLabelRow({
  node,
  depth,
  groupId,
  indent,
  dimmed,
  showInsertionBefore,
  insertionDepth,
  children,
}: SortableHabitLabelRowProps) {
  const childIds = node.children.map((c) => c.id);
  const data = (
    depth === 0
      ? {
          kind: 'habit',
          habitId: node.id,
          parentId: null,
          groupId,
          containerId: containerForGroup(groupId),
          childIds,
        }
      : {
          kind: 'habit',
          habitId: node.id,
          parentId: node.parentId!,
          groupId: null,
          // The section is the parent's, which a sub-habit's own null groupId
          // cannot name.
          containerId: containerForGroup(groupId),
          childIds: [],
        }
  ) as HabitDragData;

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: node.id, data });

  return (
    <>
      {showInsertionBefore && (
        <div
          aria-hidden="true"
          className="habit-timeline-insertion relative h-0"
          style={{ marginLeft: insertionDepth * indent }}
        >
          <span className="absolute inset-x-0 -top-px block h-px bg-ink" />
        </div>
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{ paddingLeft: depth * indent, opacity: isDragging || dimmed ? 0.4 : 1 }}
        className="habit-timeline-row-label group flex h-6 min-w-0 items-center pr-2"
        aria-label={node.name}
      >
        <HabitDragHandle label={node.name} />
        {children}
      </div>
    </>
  );
}

/** A group header, draggable to reorder whole groups. */
export function SortableGroupHeader({
  group,
  dimmed,
  children,
}: SortableGroupHeaderProps) {
  const data: HabitGroupDragData = { kind: 'habit-group', groupId: group.id };
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: group.id, data });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging || dimmed ? 0.4 : 1 }}
      className="habit-timeline-group-header group flex h-6 min-w-0 items-center pr-2"
      aria-label={group.name}
    >
      <HabitDragHandle label={group.name} />
      {children}
    </div>
  );
}

export function RowOptionsButton({ label, onOpen }: { label: string; onOpen: (x: number, y: number) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...{ [NO_DRAG_ATTR]: '' }}
      className="habit-timeline-row-options flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-ink-light opacity-0 transition-opacity duration-75 hover:bg-dot/30 hover:text-ink focus:opacity-100 group-hover:opacity-100"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onOpen(rect.left, rect.bottom + 4);
      }}
    >
      <MoreHorizontal size={14} />
    </button>
  );
}
