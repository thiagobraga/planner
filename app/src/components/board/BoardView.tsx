import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { ApiTask, BoardGroupBy } from '../../api/client';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';
import { AddColumnButton } from './AddColumnButton';
import { BoardColumn } from './BoardColumn';
import { usePlannerDrag } from '../../contexts/usePlannerDrag';
import { useEffect } from 'react';

interface BoardViewProps {
  collectionId: string;
  groupBy: BoardGroupBy;
  columns: BoardColumnModel[];
  tasks: ApiTask[];
  canAddColumn?: boolean;
  onToggle?: (taskId: string, completed: boolean) => void;
  onAddColumn?: (name: string) => void;
  onRenameColumn?: (columnId: string, name: string) => void;
  onRecolorColumn?: (columnId: string, color: string) => void;
  onMarkCompletion?: (columnId: string) => void;
  onDeleteColumn?: (columnId: string) => void;
}

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
            />
          ))}
          {canAddColumn && <AddColumnButton onAdd={onAddColumn} />}
        </div>
      </SortableContext>
    </div>
  );
}
