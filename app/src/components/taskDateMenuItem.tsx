import { Calendar } from 'lucide-react';
import type { ContextMenuItem } from './ui/ContextMenu';
import { TaskDatePickerPanel } from './ui/TaskDatePickerPanel';
import type { Task } from './TaskItem';
import type { TaskSchedule } from '../types/task';
import type { TranslationKey } from '../i18n/catalogs';

function scheduleOf(task: Task): TaskSchedule {
  return {
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    deadlineDate: task.deadlineDate ?? null,
    deadlineTime: task.deadlineTime ?? null,
    durationMinutes: task.durationMinutes ?? null,
  };
}

// Daily, Inbox and Collections share the same task row menu entry.
export function buildSetDateMenuItem(
  t: (key: TranslationKey) => string,
  task: Task | undefined,
  onSave: (taskId: string, schedule: TaskSchedule) => void,
): ContextMenuItem {
  return {
    type: 'item',
    label: t('contextMenu.setDate'),
    icon: <Calendar size={14} />,
    disabled: !task,
    panel: (close) =>
      task && (
        <TaskDatePickerPanel
          value={scheduleOf(task)}
          onSave={(schedule) => {
            onSave(task.id, schedule);
            close();
          }}
        />
      ),
  };
}
