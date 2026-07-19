import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskItem, type Task, type TaskItemProps } from './TaskItem';
import { flattenTasks, getSubtreeBlock } from '../utils/taskProjection';
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
  const dropData: DayDropData | undefined = dayDate
    ? { kind: 'day', date: dayDate, containerId }
    : undefined;

  // Registered even when empty: an empty day or collection still has to accept a
  // drop, and a SortableContext with no items cannot receive one.
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data: dropData });

  const rows = flattenTasks(tasks);
  const carried = new Set(
    activeDragId ? getSubtreeBlock(rows, activeDragId).slice(1).map((r) => r.id) : [],
  );
  const subtreeIdsOf = new Map(
    rows.map((r) => [r.id, getSubtreeBlock(rows, r.id).map((b) => b.id)]),
  );

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
              isCarried={carried.has(task.id)}
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
