import type { ReactNode } from 'react';
import { AlarmClock, Repeat } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { Task } from '../types/task';
import { formatDueDate } from '../utils/formatDueDate';
import { recurrenceSummary } from '../utils/recurrenceSummary';
import { formatDuration, formatTimeWindow } from '../utils/taskTime';
import { priorityClasses } from './taskPriorityClasses';
import { TaskMetaChip } from './ui/Chip';
import './TaskItemMeta.css';

interface TaskItemMetaProps {
  task: Task;
  hideDueDate?: boolean;
  collectionBadge?: ReactNode;
}

/** Task row metadata pills in canonical order: date/hour, repeat, deadline, priority, collection, tags. */
export function TaskItemMeta({ task, hideDueDate, collectionBadge }: TaskItemMetaProps) {
  const { locale, t } = useI18n();
  const showDueDate = Boolean(task.dueDate && !hideDueDate);
  const timeText = task.dueTime
    ? formatTimeWindow(task.dueTime, task.endTime)
    : task.durationMinutes
      ? formatDuration(task.durationMinutes)
      : null;
  const timeClassName = task.dueTime ? 'task-item-time' : 'task-item-duration';
  const showPriority = task.priority >= 1 && task.priority <= 3;
  const hasLabels = Boolean(task.labels && task.labels.length > 0);

  if (
    !showDueDate &&
    !timeText &&
    !task.recurrenceRule &&
    !task.deadlineDate &&
    !showPriority &&
    !collectionBadge &&
    !hasLabels
  ) {
    return null;
  }

  return (
    <span className="task-item-meta inline-flex flex-wrap items-center gap-x-1.5 ml-1.5">
      {(showDueDate || timeText) && (
        <span className="task-item-schedule h-6 inline-flex items-center shrink-0">
          {showDueDate && timeText ? (
            <TaskMetaChip
              primaryClassName="task-item-due-date"
              secondary={timeText}
              secondaryClassName={timeClassName}
            >
              {formatDueDate(task.dueDate!, locale)}
            </TaskMetaChip>
          ) : showDueDate ? (
            <TaskMetaChip primaryClassName="task-item-due-date">
              {formatDueDate(task.dueDate!, locale)}
            </TaskMetaChip>
          ) : (
            <TaskMetaChip primaryClassName={timeClassName}>
              {timeText}
            </TaskMetaChip>
          )}
        </span>
      )}

      {task.recurrenceRule && (
        <span className="task-item-repeat h-6 inline-flex items-center shrink-0">
          <TaskMetaChip>
            <Repeat className="w-3 h-3 shrink-0" aria-hidden="true" />
            {recurrenceSummary(task.recurrenceRule, locale)}
          </TaskMetaChip>
        </span>
      )}

      {task.deadlineDate && (
        <span
          className="task-item-deadline h-6 inline-flex items-center shrink-0"
          title={t('task.deadline')}
        >
          <TaskMetaChip textClassName="text-danger-text">
            <AlarmClock className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>
              {formatDueDate(task.deadlineDate, locale)}
              {task.deadlineTime && ` ${task.deadlineTime}`}
            </span>
          </TaskMetaChip>
        </span>
      )}

      {showPriority && (
        <span className="task-item-priority h-6 inline-flex items-center shrink-0">
          <TaskMetaChip textClassName={priorityClasses[task.priority]}>
            !{task.priority}
          </TaskMetaChip>
        </span>
      )}

      {collectionBadge && (
        <span className="task-item-collection h-6 inline-flex items-center shrink-0">{collectionBadge}</span>
      )}

      {hasLabels && (
        <span className="task-item-labels inline-flex flex-wrap items-center gap-x-1.5">
          {task.labels!.map((label) => (
            <span key={label.id} className="h-6 inline-flex items-center shrink-0">
              <TaskMetaChip className="task-item-label-chip">
                <span
                  aria-hidden="true"
                  className="w-1.75 h-1.75 rounded-full shrink-0 filter-[saturate(0.55)]"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </TaskMetaChip>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
