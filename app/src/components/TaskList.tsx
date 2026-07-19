import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskItem, type Task, type TaskItemProps } from './TaskItem';
import { flattenTasks, getSubtreeBlock, projectMove, INDENT_WIDTH } from '../utils/taskProjection';
import { usePlannerDrag } from '../contexts/PlannerDragContext';
import type { DayDropData } from '../types/drag';

type TaskCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onIndent' | 'onNavigate' | 'onConvertType'
>;

interface TaskListProps extends TaskCallbacks {
  tasks: Task[];
  editingId?: string;
  dimNotes?: boolean;
  hideDueDate?: boolean;
  italicDueDate?: boolean;
  /** Stable id for this list, used as the drag container and droppable id. */
  containerId: string;
  /**
   * Set on Daily, where each rendered date is its own drop target. Omitted for
   * collection lists, which are addressed by container id alone.
   */
  dayDate?: string;
  /** The task currently being dragged, so its descendants can be dimmed. */
  activeDragId?: string | null;
  /** Rendered next to a row's title - Daily uses it for the collection chip. */
  renderBadge?: (task: Task) => ReactNode;
  onTaskToggle?: (id: string) => void;
}

/**
 * A list of tasks registered as one sortable container.
 *
 * It no longer owns a DndContext: that lives in PlannerDragProvider so a drag
 * can leave this list entirely - onto another date, or onto a sidebar
 * collection. It also no longer reports a reordered array, because a flat array
 * cannot express reparenting; the page computes the structural move from the
 * shared projection helpers instead.
 */
export function TaskList({
  tasks,
  editingId,
  dimNotes,
  hideDueDate,
  italicDueDate,
  containerId,
  dayDate,
  activeDragId,
  renderBadge,
  onTaskToggle,
  onStartEdit,
  onEditCommit,
  onEditCancel,
  onDelete,
  onAddBelow,
  onIndent,
  onNavigate,
  onConvertType,
}: TaskListProps) {
  const { indentSteps, overId } = usePlannerDrag();

  const dropData: DayDropData | undefined = dayDate
    ? { kind: 'day', date: dayDate, containerId }
    : undefined;

  // Registered even when empty: an empty day or collection still has to accept a
  // drop, and a SortableContext with no items cannot receive one.
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data: dropData });

  const allRows = flattenTasks(tasks);
  const subtreeIdsOf = new Map(
    allRows.map((r) => [r.id, getSubtreeBlock(allRows, r.id).map((b) => b.id)]),
  );

  // While a parent is dragged, its descendants are removed from the list rather
  // than left in place. dnd-kit sorts each row independently, so leaving them
  // would shift only the parent's placeholder and strand the children behind it
  // - they would appear detached, at the wrong depth, mid-drag. Collapsing the
  // block means the single remaining parent row represents the whole subtree,
  // which is what the overlay's "+N" already says.
  const carried = activeDragId
    ? new Set(getSubtreeBlock(allRows, activeDragId).slice(1).map((r) => r.id))
    : new Set<string>();
  const rows = carried.size > 0 ? allRows.filter((r) => !carried.has(r.id)) : allRows;

  // The dragged row doubles as the insertion indicator: dnd-kit already moves it
  // to the drop position, so showing it at the projected depth previews exactly
  // where the block will land.
  const projection =
    activeDragId && rows.some((r) => r.id === activeDragId) && overId
      ? projectMove(
          rows,
          activeDragId,
          Math.max(0, rows.findIndex((r) => r.id === overId)),
          indentSteps * INDENT_WIDTH,
        )
      : null;

  return (
    <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        role="list"
        aria-label="task list"
        className={`task-list flex flex-col gap-0 ${isOver ? 'task-list--drop-target' : ''}`}
      >
        {rows.map(({ task }) => (
          <div key={task.id} role="listitem" className="task-list-item">
            <TaskItem
              task={task}
              containerId={containerId}
              subtreeIds={subtreeIdsOf.get(task.id)}
              projectedDepth={
                projection && task.id === activeDragId ? projection.depth : undefined
              }
              collectionBadge={renderBadge?.(task)}
              isEditing={task.id === editingId}
              dimmed={dimNotes && task.type === 'note'}
              hideDueDate={hideDueDate}
              italicDueDate={italicDueDate}
              onToggle={onTaskToggle}
              onStartEdit={onStartEdit}
              onEditCommit={onEditCommit}
              onEditCancel={onEditCancel}
              onDelete={onDelete}
              onAddBelow={onAddBelow}
              onIndent={onIndent}
              onNavigate={onNavigate}
              onConvertType={onConvertType}
            />
          </div>
        ))}
      </div>
    </SortableContext>
  );
}
