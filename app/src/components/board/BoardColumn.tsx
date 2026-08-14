import { useCallback, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiTask, BoardGroupBy } from '../../api/client';
import type {
  BoardColumnDragData,
  BoardColumnDropData,
  BoardColumnHeaderDropData,
} from '../../types/drag';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';
import { buildSubtreeIndex, flattenTasks } from '../../utils/taskProjection';
import { BoardCard } from './BoardCard';
import { BoardColumnHeader } from './BoardColumnHeader';
import { useI18n } from '../../i18n/I18nContext';

interface BoardColumnProps {
  collectionId: string;
  groupBy: BoardGroupBy;
  column: BoardColumnModel;
  allTasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
  onRename?: (columnId: string, name: string) => void;
  onRecolor?: (columnId: string, color: string) => void;
  onMarkCompletion?: (columnId: string) => void;
  onDelete?: (columnId: string) => void;
}

export function BoardColumn({
  collectionId,
  groupBy,
  column,
  allTasks,
  onToggle,
  onRename,
  onRecolor,
  onMarkCompletion,
  onDelete,
}: BoardColumnProps) {
  const { t } = useI18n();
  const subtreeIndex = useMemo(() => buildSubtreeIndex(flattenTasks(allTasks)), [allTasks]);
  const canEdit = groupBy === 'status' || (groupBy === 'section' && column.value !== null);
  const canReorder = groupBy !== 'priority' && column.value !== null;
  const dragData: BoardColumnDragData = {
    kind: 'board-column',
    columnId: column.id,
    collectionId,
    groupBy,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: dragData, disabled: !canReorder });

  const columnDropData: BoardColumnDropData = {
    kind: 'board-column',
    columnId: column.id,
    collectionId,
    groupBy,
    containerId: column.id,
  };
  const { setNodeRef: setColumnDropRef, isOver } = useDroppable({
    id: `column-drop:${column.id}`,
    data: columnDropData,
  });

  const headerDropData: BoardColumnHeaderDropData = {
    kind: 'board-column-header',
    columnId: column.id,
    collectionId,
    groupBy,
  };
  const { setNodeRef: setHeaderDropRef } = useDroppable({
    id: `column-header:${column.id}`,
    data: headerDropData,
    disabled: !canReorder,
  });
  const setHeaderRef = useCallback((node: HTMLElement | null) => {
    setActivatorNodeRef(node);
    setHeaderDropRef(node);
  }, [setActivatorNodeRef, setHeaderDropRef]);

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-over' : ''}`}
      data-column-id={column.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <BoardColumnHeader
        columnId={column.id}
        groupBy={groupBy}
        title={column.title}
        count={column.tasks.length}
        color={column.color}
        isCompletionStatus={column.isCompletionStatus}
        canEdit={canEdit}
        dragHandleProps={canReorder ? { ...attributes, ...listeners } : undefined}
        setDragHandleRef={canReorder ? setHeaderRef : undefined}
        onRename={canEdit ? (name) => onRename?.(column.id, name) : undefined}
        onRecolor={groupBy === 'status' ? (color) => onRecolor?.(column.id, color) : undefined}
        onMarkCompletion={groupBy === 'status' ? () => onMarkCompletion?.(column.id) : undefined}
        onDelete={canEdit ? () => onDelete?.(column.id) : undefined}
      />
      <div ref={setColumnDropRef} className="board-column-cards">
        {column.tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            subtasks={allTasks.filter((candidate) => candidate.parentTaskId === task.id)}
            containerId={column.id}
            subtreeIds={subtreeIndex.get(task.id)}
            onToggle={onToggle}
          />
        ))}
        {column.tasks.length === 0 && <div className="board-column-empty">{t('board.dropHere')}</div>}
      </div>
    </section>
  );
}
