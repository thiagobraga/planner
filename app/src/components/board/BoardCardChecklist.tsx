import { Check } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ApiTask } from '../../api/client';
import type { CardSubtasksDropData, TaskDragData } from '../../types/drag';
import { NO_DRAG_ATTR } from '../dnd/sensors';
import { useI18n } from '../../i18n/I18nContext';

interface BoardCardChecklistProps {
  parentTask: ApiTask;
  tasks: ApiTask[];
  onToggle?: (taskId: string, completed: boolean) => void;
}

function SortableChecklistRow({
  task,
  parentTask,
  onToggle,
}: {
  task: ApiTask;
  parentTask: ApiTask;
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

  const { t } = useI18n();
  const isNote = task.type === 'note';

  return (
    <label
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
          {task.isCompleted && <Check size={10} strokeWidth={2} />}
        </button>
      )}
      <span className={task.isCompleted ? 'line-through opacity-55' : ''}>{task.title}</span>
    </label>
  );
}

export function BoardCardChecklist({ parentTask, tasks, onToggle }: BoardCardChecklistProps) {
  const completed = tasks.filter((task) => task.isCompleted).length;
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
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableChecklistRow
            key={task.id}
            task={task}
            parentTask={parentTask}
            onToggle={onToggle}
          />
        ))}
      </SortableContext>
    </div>
  );
}
