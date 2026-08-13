import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { ApiTask } from '../../api/client';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';
import { AddColumnButton } from './AddColumnButton';
import { BoardColumn } from './BoardColumn';
import { usePlannerDrag } from '../../contexts/usePlannerDrag';
import { useEffect } from 'react';

interface BoardViewProps {
  columns: BoardColumnModel[];
  tasks: ApiTask[];
  canAddColumn?: boolean;
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function BoardView({ columns, tasks, canAddColumn, onToggle }: BoardViewProps) {
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
            <BoardColumn key={column.id} column={column} allTasks={tasks} onToggle={onToggle} />
          ))}
          {canAddColumn && <AddColumnButton />}
        </div>
      </SortableContext>
    </div>
  );
}
