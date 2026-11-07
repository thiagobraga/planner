import { useEffect, useMemo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskItem, type Task, type TaskItemProps } from './TaskItem';
import {
  buildSubtreeIndex,
  flattenTasks,
  getSubtreeBlock,
  projectTaskDrop,
  projectionFitsSubtree,
  INDENT_WIDTH,
} from '../utils/taskProjection';
import { usePlannerDrag } from '../contexts/usePlannerDrag';
import { TaskBlockPreview } from './TaskBlockPreview';
import type { BoardColumnDropData, DayDropData, NoDateDropData, SectionDropData } from '../types/drag';
import { useI18n } from '../i18n/I18nContext';
import type { TaskOrderScope } from '../types/drag';
import type { TaskIndentHandler, TaskListContextMenuHandler } from '../types/taskIndent';
import { parseColumnId } from '../utils/boardColumns';

export type TaskListCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onConvertType'
> & { onIndent?: TaskIndentHandler; onRightClick?: TaskListContextMenuHandler };

function listScope(task: Task, dayDate: string | undefined, sectionId: string | undefined,
  collectionId: string | undefined, dropData: TaskListProps['dropData']): TaskOrderScope {
  const collection = collectionId ?? task.collectionId ?? '';
  if (dayDate) return { kind: 'day', dueDate: dayDate };
  if (dropData?.kind === 'day') return { kind: 'day', dueDate: dropData.date };
  if (dropData?.kind === 'board-column') {
    const column = parseColumnId(dropData.columnId);
    if (column?.groupBy === 'status') return { kind: 'status', collectionId: collection, statusId: column.value as string };
    if (column?.groupBy === 'priority') return { kind: 'priority', collectionId: collection, priority: column.value as number };
    if (column?.groupBy === 'section' && column.value) return { kind: 'section', sectionId: column.value as string };
  }
  if (sectionId) return { kind: 'section', sectionId };
  if (dropData?.kind === 'no-date' && task.dueDate) return { kind: 'day', dueDate: task.dueDate.slice(0, 10) };
  return { kind: 'collection', collectionId: collection };
}

export interface TaskListProps extends TaskListCallbacks {
  tasks: Task[];
  editingId?: string;
  dimNotes?: boolean;
  hideDueDate?: boolean;
  /** Stable id for this list, used as the drag container and droppable id. */
  containerId: string;
  /** A board list needs its own drop id because its column is also sortable. */
  dropId?: string;
  /**
   * Set on Daily, where each rendered date is its own drop target. Omitted for
   * collection lists, which are addressed by container id alone.
   */
  dayDate?: string;
  /**
   * Set on Collections/Inbox when grouping tasks by section. Creates a section
   * drop target so tasks can be moved into this section.
   */
  sectionId?: string;
  /** Required when sectionId is set; used to populate SectionDropData. */
  collectionId?: string;
  /** Supplies a grouped-board destination for an otherwise empty task list. */
  dropData?: DayDropData | NoDateDropData | SectionDropData | BoardColumnDropData;
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
  containerId,
  dropId,
  dayDate,
  sectionId,
  collectionId,
  dropData: dropDataProp,
  activeDragId,
  renderBadge,
  onTaskToggle,
  onStartEdit,
  onEditCommit,
  onEditCancel,
  onDelete,
  onAddBelow,
  onIndent,
  onConvertType,
  onRightClick,
}: TaskListProps) {
  const { t } = useI18n();
  const { indentSteps, overId, hasMoved, setOverlayNode } = usePlannerDrag();

  const dropData: DayDropData | NoDateDropData | SectionDropData | BoardColumnDropData | undefined = dropDataProp ?? (dayDate
    ? { kind: 'day', date: dayDate, containerId }
    : sectionId && collectionId
      ? { kind: 'section', sectionId, collectionId, containerId }
      : undefined);

  // Registered even when empty: an empty day or collection still has to accept a
  // drop, and a SortableContext with no items cannot receive one.
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? containerId, data: dropData });

  // Derived from `tasks` alone, so it survives the renders a drag forces: every
  // change of projected depth or hovered row re-renders this list, and
  // reflattening the tree each time made the cost of a drag scale with the list.
  const allRows = useMemo(() => flattenTasks(tasks), [tasks]);
  const visibleTasks = useMemo(() => allRows.map((row) => row.task), [allRows]);
  const subtreeIdsOf = useMemo(() => buildSubtreeIndex(allRows), [allRows]);

  // Memoised per row, because a fresh element on every render would defeat
  // TaskItem's memo for the whole list on each drag frame.
  const badges = useMemo(() => {
    if (!renderBadge) return null;
    return new Map(allRows.map((r) => [r.id, renderBadge(r.task)]));
  }, [allRows, renderBadge]);

  // While a parent is dragged, its descendants are removed from the list rather
  // than left in place. dnd-kit sorts each row independently, so leaving them
  // would shift only the parent's placeholder and strand the children behind it
  // - they would appear detached, at the wrong depth, mid-drag. Collapsing the
  // block means the single remaining parent row represents the whole subtree.
  //
  // Held back until the pointer actually travels, so pressing a row changes
  // nothing: a press that collapses a subtree before any movement reads as the
  // list reacting to a click the user has not finished making.
  const rows = useMemo(() => {
    if (!activeDragId || !hasMoved) return allRows;
    const carried = new Set(getSubtreeBlock(allRows, activeDragId).slice(1).map((r) => r.id));
    return carried.size > 0 ? allRows.filter((r) => !carried.has(r.id)) : allRows;
  }, [allRows, activeDragId, hasMoved]);

  const overIndex = overId ? rows.findIndex((r) => r.id === overId) : -1;
  const holdsActiveRow = !!activeDragId && rows.some((r) => r.id === activeDragId);
  const activeTask = allRows.find((row) => row.id === activeDragId)?.task;
  const hoveredTask = rows[overIndex]?.task;
  const sameNestingScope = activeTask && hoveredTask &&
    activeTask.collectionId === hoveredTask.collectionId &&
    (activeTask.sectionId ?? null) === (hoveredTask.sectionId ?? null) &&
    (activeTask.dueDate?.slice(0, 10) ?? null) === (hoveredTask.dueDate?.slice(0, 10) ?? null);

  // The dragged row doubles as the insertion indicator: dnd-kit already moves it
  // to the drop position, so showing it at the projected depth previews exactly
  // where the block will land.
  //
  // Only while the hovered row is one of ours, though. `findIndex` returns -1
  // for a target in another list, and clamping that to 0 previewed the row
  // leaping to the top of its own day whenever the pointer crossed into a
  // different one.
  const projected =
    holdsActiveRow && overIndex !== -1
      ? projectTaskDrop(rows, activeDragId!, overId, indentSteps * INDENT_WIDTH)
      : null;
  const destination = projected && !sameNestingScope
    ? { ...projected, parentId: null, depth: 0 }
    : projected;
  const projection = destination && projectionFitsSubtree(rows, activeDragId!, destination)
    ? destination
    : null;
  const nestsOnHoveredRow = hasMoved && projection?.parentId === overId && overId !== activeDragId;

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

  // Hand the travelling rows up to the overlay, from the first frame of the
  // drag. Deliberately *not* gated on `hasMoved` the way the list's own layout
  // is: the overlay is drawn over the row rather than in the flow, so publishing
  // it early reflows nothing, while publishing it late meant a press showed the
  // fallback title chip - taller than a row, and missing the bullet - until the
  // pointer travelled and the real block replaced it mid-gesture.
  const draggedBlock = useMemo(
    () => (activeDragId ? getSubtreeBlock(allRows, activeDragId) : null),
    [allRows, activeDragId],
  );

  useEffect(() => {
    if (!draggedBlock || draggedBlock.length === 0) return;
    setOverlayNode(
      <TaskBlockPreview rows={draggedBlock.map((r) => ({ task: r.task, depth: r.depth }))} />,
    );
    return () => setOverlayNode(null);
  }, [draggedBlock, setOverlayNode]);

  return (
    <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        role="list"
        aria-label={t('task.list')}
        // Every list claims a row of drop area below itself, so the 24px seam
        // before the next date is never a dead zone no droppable covers. The
        // class cancels its own height with a negative margin - see the note on
        // the rule for why it has to cost the layout nothing.
        //
        // Applied unconditionally rather than only while `activeDrag` is set:
        // dnd-kit measures every droppable's rect once at drag start
        // (`MeasuringStrategy.BeforeDragging`), which runs before React has
        // committed the re-render that would add a drag-conditional class. The
        // padding therefore was not part of the measured rect, and the hit area
        // that lets a row drop *below* the last one never existed for the rest
        // of the gesture.
        className="task-list task-list--drag-target flex flex-col gap-0"
      >
        {showEmptyInsert && (
          <div aria-hidden className="task-list-slot" style={{ marginLeft: foreignInsertDepth * INDENT_WIDTH }} />
        )}
        {rows.map(({ task, depth }) => (
          <div key={task.id} role="listitem" className={`task-list-item${task.moved ? ' task-list-item--moved' : ''}`}>
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
              departed={hasMoved && task.id === activeDragId && (!landsHere || nestsOnHoveredRow || (overIndex !== -1 && !projection))}
              collectionBadge={badges?.get(task.id)}
              isEditing={task.id === editingId}
              dimmed={dimNotes && task.type === 'note'}
              hideDueDate={hideDueDate}
              onToggle={onTaskToggle}
              onStartEdit={onStartEdit}
              onEditCommit={onEditCommit}
              onEditCancel={onEditCancel}
              onDelete={onDelete}
              onAddBelow={onAddBelow}
              onIndent={onIndent ? (id, direction) => onIndent(id, direction, visibleTasks, listScope(task, dayDate, sectionId, collectionId, dropData)) : undefined}
              onConvertType={onConvertType}
              onRightClick={onRightClick ? (id, position) => onRightClick(id, position, visibleTasks, listScope(task, dayDate, sectionId, collectionId, dropData)) : undefined}
            />
            {nestsOnHoveredRow && task.id === overId && (
              <div aria-hidden className="task-list-slot" style={{ marginLeft: projection.depth * INDENT_WIDTH }} />
            )}
          </div>
        ))}
      </div>
    </SortableContext>
  );
}
