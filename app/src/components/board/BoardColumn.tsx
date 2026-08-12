import type { ApiTask } from '../../api/client';
import type { BoardColumn as BoardColumnModel } from '../../utils/boardColumns';
import { BoardCard } from './BoardCard';
import { BoardColumnHeader } from './BoardColumnHeader';
import { useI18n } from '../../i18n/I18nContext';

interface BoardColumnProps {
  column: BoardColumnModel;
  allTasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function BoardColumn({ column, allTasks, onToggle }: BoardColumnProps) {
  const { t } = useI18n();
  return (
    <section className="board-column" data-column-id={column.id}>
      <BoardColumnHeader title={column.title} count={column.tasks.length} color={column.color} />
      <div className="board-column-cards">
        {column.tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            subtasks={allTasks.filter((candidate) => candidate.parentTaskId === task.id)}
            onToggle={onToggle}
          />
        ))}
        {column.tasks.length === 0 && <div className="board-column-empty">{t('board.dropHere')}</div>}
      </div>
    </section>
  );
}
