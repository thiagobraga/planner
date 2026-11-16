import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { AddColumnButton } from './AddColumnButton';
import { BoardColumn } from './BoardColumn';
import { usePlannerDrag } from '../../contexts/usePlannerDrag';
import { useEffect } from 'react';
import type { BoardViewProps } from '../../types/board';

export function BoardView({
  collectionId,
  groupBy,
  columns,
  tasks,
  canAddColumn,
  onToggle,
  onAddColumn,
  onRenameColumn,
  onRecolorColumn,
  onMarkCompletion,
  onDeleteColumn,
  statuses,
  onUpdateStatusRoute,
  onCreateTask,
  presentation = 'kanban',
  taskListProps,
}: BoardViewProps) {
  const { setAutoScrollAxis } = usePlannerDrag();
  useEffect(() => {
    setAutoScrollAxis('horizontal');
    return () => setAutoScrollAxis('vertical');
  }, [setAutoScrollAxis]);

  return (
    <div className="board-scroll" data-testid="board-view">
      <SortableContext items={columns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
        <div className="board-grid">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              collectionId={collectionId}
              groupBy={groupBy}
              column={column}
              allTasks={tasks}
              onToggle={onToggle}
              onRename={onRenameColumn}
              onRecolor={onRecolorColumn}
              onMarkCompletion={onMarkCompletion}
              onDelete={onDeleteColumn}
              statuses={statuses}
              onUpdateStatusRoute={onUpdateStatusRoute}
              onCreate={onCreateTask}
              presentation={presentation}
              taskListProps={taskListProps}
            />
          ))}
          {canAddColumn && <AddColumnButton onAdd={onAddColumn} />}
        </div>
      </SortableContext>
    </div>
  );
}
