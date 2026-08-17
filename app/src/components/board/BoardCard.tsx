import { CalendarDays, Check, Flag } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiTask } from '../../api/client';
import type { TaskDragData } from '../../types/drag';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { BoardCardChecklist } from './BoardCardChecklist';
import { useI18n } from '../../i18n/I18nContext';

interface BoardCardProps {
  task: ApiTask;
  subtasks: ApiTask[];
  containerId?: string;
  subtreeIds?: string[];
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function BoardCard({ task, subtasks, containerId = '', subtreeIds, onToggle }: BoardCardProps) {
  const { t } = useI18n();
  const dragData: TaskDragData = {
    kind: 'task',
    taskId: task.id,
    parentTaskId: task.parentTaskId ?? null,
    collectionId: task.collectionId,
    sectionId: task.sectionId ?? null,
    dueDate: task.dueDate ?? null,
    depth: task.depth ?? 0,
    containerId,
    subtreeIds: subtreeIds ?? [task.id, ...subtasks.map((subtask) => subtask.id)],
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: dragData,
  });
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`board-card ${isDragging ? 'is-dragging' : ''}`}
      data-card-id={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="board-card-topline">
        <button
          type="button"
          className={`board-card-check ${task.isCompleted ? 'is-complete' : ''}`}
          {...{ [NO_DRAG_ATTR]: '' }}
          aria-label={task.isCompleted ? t('board.reopenTask') : t('board.completeTask')}
          onClick={() => onToggle?.(task.id, !task.isCompleted)}
        >
          {task.isCompleted && <Check size={12} strokeWidth={2} />}
        </button>
        <h3 className={task.isCompleted ? 'line-through opacity-60' : ''}>{task.title}</h3>
        <span className={`board-card-priority priority-${task.priority}`} aria-label={t('board.priority', { priority: task.priority })}>
          <Flag size={14} strokeWidth={1.7} />
        </span>
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="board-card-labels">
          {task.labels.map((label) => (
            <span key={label.id} className="board-card-chip" style={{ borderColor: label.color }}>
              <span aria-hidden="true" style={{ backgroundColor: label.color }} />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {task.description && <p className="board-card-description">{task.description}</p>}

      <BoardCardChecklist parentTask={task} tasks={subtasks} onToggle={onToggle} />

      {(task.dueDate || task.completedAt) && (
        <footer className="board-card-date">
          {task.completedAt ? <Check size={13} /> : <CalendarDays size={13} />}
          <span>{task.completedAt?.slice(0, 10) ?? task.dueDate}</span>
        </footer>
      )}
    </article>
  );
}
