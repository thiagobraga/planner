import type { ApiTask } from '../../api/client';

interface BoardCardChecklistProps {
  tasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function BoardCardChecklist({ tasks, onToggle }: BoardCardChecklistProps) {
  if (tasks.length === 0) return null;
  const completed = tasks.filter((task) => task.isCompleted).length;

  return (
    <div className="board-card-checklist" aria-label={`${completed}/${tasks.length}`}>
      <div className="board-card-checklist-count">{completed}/{tasks.length}</div>
      {tasks.map((task) => (
        <label key={task.id} className="board-card-checklist-row">
          <input
            type="checkbox"
            checked={task.isCompleted}
            onChange={(event) => onToggle?.(task.id, event.target.checked)}
          />
          <span className={task.isCompleted ? 'line-through opacity-55' : ''}>{task.title}</span>
        </label>
      ))}
    </div>
  );
}
