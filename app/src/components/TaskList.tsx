import { useEffect, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskItem, type Task, type TaskItemProps } from './TaskItem';
import { flattenTasks, getSubtreeBlock, projectMove, INDENT_WIDTH } from '../utils/taskProjection';
import { usePlannerDrag } from '../contexts/PlannerDragContext';
import { TaskBlockPreview } from './TaskBlockPreview';
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
  const { indentSteps, overId, hasMoved, setOverlayNode } = usePlannerDrag();

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
  // block means the single remaining parent row represents the whole subtree.
  //
  // Held back until the pointer actually travels, so pressing a row changes
  // nothing: a press that collapses a subtree before any movement reads as the
  // list reacting to a click the user has not finished making.
  const carried =
    activeDragId && hasMoved
      ? new Set(getSubtreeBlock(allRows, activeDragId).slice(1).map((r) => r.id))
      : new Set<string>();
  const rows = carried.size > 0 ? allRows.filter((r) => !carried.has(r.id)) : allRows;

  const overIndex = overId ? rows.findIndex((r) => r.id === overId) : -1;
  const holdsActiveRow = !!activeDragId && rows.some((r) => r.id === activeDragId);

  // The dragged row doubles as the insertion indicator: dnd-kit already moves it
  // to the drop position, so showing it at the projected depth previews exactly
  // where the block will land.
  //
  // Only while the hovered row is one of ours, though. `findIndex` returns -1
  // for a target in another list, and clamping that to 0 previewed the row
  // leaping to the top of its own day whenever the pointer crossed into a
  // different one.
  const projection =
    holdsActiveRow && overIndex !== -1
      ? projectMove(rows, activeDragId!, overIndex, indentSteps * INDENT_WIDTH)
      : null;

  // Daily renders each date as its own list, so a row dragged across dates stays
  // mounted in the list it came from and this one has nothing to reposition.
  // Without a standalone marker the destination gave no sign of where the drop
  // would land - the whole gesture previewed only in the day it started from.
  // Where the drop would land, as far as this list is concerned. A list that
  // holds the dragged row but is not the destination must not keep drawing a
  // slot: with the destination drawing one too, the same drag appeared to be
  // heading for two places at once.
  const landsHere = overIndex !== -1 || isOver;

  const insertAfterId =
    hasMoved && !holdsActiveRow && overIndex !== -1 ? rows[overIndex].id : null;
  const showEmptyInsert = hasMoved && !holdsActiveRow && rows.length === 0 && isOver;

  // A drop arriving from another date lands at top level, so the slot shown here
  // is flush. Within a list the dragged row is its own placeholder and carries
  // the projected depth itself.
  const foreignInsertDepth = 0;

  // Hand the travelling rows up to the overlay. Only the list holding them can
  // draw them, and only once the drag is really under way - before that the row
  // is still sitting in place and there is nothing to float.
  const draggedBlock =
    activeDragId && hasMoved ? getSubtreeBlock(allRows, activeDragId) : null;

  useEffect(() => {
    if (!draggedBlock || draggedBlock.length === 0) return;
    setOverlayNode(
      <TaskBlockPreview rows={draggedBlock.map((r) => ({ task: r.task, depth: r.depth }))} />,
    );
    return () => setOverlayNode(null);
    // Identity of the block is what matters, not the array instance.
  }, [draggedBlock?.map((r) => r.id).join(','), setOverlayNode]);

  return (
    <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        role="list"
        aria-label="task list"
        className="task-list flex flex-col gap-0"
      >
        {showEmptyInsert && (
          <div aria-hidden className="task-list-slot" style={{ marginLeft: foreignInsertDepth * INDENT_WIDTH }} />
        )}
        {rows.map(({ task, depth }) => (
          <div key={task.id} role="listitem" className="task-list-item">
            {task.id === insertAfterId && (
              <div aria-hidden className="task-list-slot" style={{ marginLeft: foreignInsertDepth * INDENT_WIDTH }} />
            )}
            <TaskItem
              task={task}
              containerId={containerId}
              subtreeIds={subtreeIdsOf.get(task.id)}
              renderedDepth={depth}
              projectedDepth={
                projection && task.id === activeDragId ? projection.depth : undefined
              }
              departed={hasMoved && task.id === activeDragId && !landsHere}
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
