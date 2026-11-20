import { Check } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiTask } from '../../types/api';
import type { CardSubtasksDropData, TaskDragData } from '../../types/drag';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import type { BoardCardChecklistProps } from '../../types/board';
import { useI18n } from '../../i18n/I18nContext';
import { openTaskDetails } from '../../stores/taskDetailStore';

const PREVIEW_ROWS = 5;

function SortableChecklistRow({
  task,
  parentTask,
  childCount,
  onToggle,
}: {
  task: ApiTask;
  parentTask: ApiTask;
  childCount: number;
  onToggle?: (taskId: string, completed: boolean) => void;
}) {
  const data: TaskDragData = {
    kind: 'task',
    taskId: task.id,
    parentTaskId: task.parentTaskId ?? null,
    collectionId: task.collectionId,
    sectionId: task.sectionId ?? null,
    dueDate: task.dueDate ?? null,
    depth: task.depth ?? 1,
    containerId: `card:${parentTask.id}`,
    subtreeIds: [task.id],
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data,
  });

  const isNote = task.type === 'note';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`board-card-checklist-row ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-subtask-id={task.id}
    >
      {isNote ? (
        <span className="board-card-checklist-dash" aria-hidden="true">-</span>
      ) : (
        <button
          type="button"
          className={`board-card-check ${task.isCompleted ? 'is-complete' : ''}`}
          {...{ [NO_DRAG_ATTR]: '' }}
          aria-label={task.isCompleted ? 'Reopen task' : 'Complete task'}
          onClick={() => onToggle?.(task.id, !task.isCompleted)}
        >
          {task.isCompleted && <Check size={9} strokeWidth={3} />}
        </button>
      )}
      <span className={task.isCompleted ? 'line-through opacity-55' : ''}>{task.title}</span>
      {childCount > 0 && <span className="board-card-checklist-meta">{childCount}</span>}
    </div>
  );
}

export function BoardCardChecklist({ parentTask, tasks, progress, childCounts, onToggle }: BoardCardChecklistProps) {
  const { t } = useI18n();
  const completed = tasks.filter((task) => task.isCompleted).length;
  const actionable = tasks.filter((task) => task.type !== 'note');
  const { done, total } = progress ?? { done: actionable.filter((task) => task.isCompleted).length, total: actionable.length };
  const preview = tasks.slice(0, PREVIEW_ROWS);
  const dropData: CardSubtasksDropData = {
    kind: 'card-subtasks',
    taskId: parentTask.id,
    collectionId: parentTask.collectionId,
  };
  const { setNodeRef, isOver } = useDroppable({
    id: `card-subtasks:${parentTask.id}`,
    data: dropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`board-card-checklist ${isOver ? 'is-over' : ''} ${tasks.length === 0 ? 'is-empty' : ''}`}
      aria-label={`${completed}/${tasks.length}`}
      data-testid={`card-subtasks-${parentTask.id}`}
    >
      {total > 0 && (
        <div className="board-card-progress">
          <div
            className="board-card-progress-bar"
            role="progressbar"
            aria-label={t('detail.progress')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span style={{ width: `${Math.round((100 * done) / total)}%` }} />
          </div>
          <span>{t('board.progressCount', { done, total })}</span>
        </div>
      )}
      <SortableContext items={preview.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {preview.map((task) => (
          <SortableChecklistRow
            key={task.id}
            task={task}
            parentTask={parentTask}
            childCount={childCounts?.get(task.id) ?? 0}
            onToggle={onToggle}
          />
        ))}
      </SortableContext>
      {tasks.length > PREVIEW_ROWS && (
        <button
          type="button"
          className="board-card-show-all"
          {...{ [NO_DRAG_ATTR]: '' }}
          onClick={(event) => {
            event.stopPropagation();
            openTaskDetails(parentTask.id, { origin: event.currentTarget, mode: 'tasks', focusPanel: true });
          }}
        >
          {t('board.showAll', { count: tasks.length })}
        </button>
      )}
    </div>
  );
}
