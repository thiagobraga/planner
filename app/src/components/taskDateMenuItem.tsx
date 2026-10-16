import { Calendar } from 'lucide-react';
import type { ContextMenuItem } from './ui/ContextMenu';
import { TaskDatePickerPanel } from './ui/TaskDatePickerPanel';
import type { Task } from './TaskItem';
import type { TaskSchedule } from '../types/task';
import type { TranslationKey } from '../i18n/catalogs';

// Some views keep the API's full timestamp ("2026-10-15T00:00:00.000Z"); the picker works in date keys.
const dateKey = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);

export function scheduleOf(task: Task): TaskSchedule {
  return {
    dueDate: dateKey(task.dueDate),
    dueTime: task.dueTime ?? null,
    deadlineDate: dateKey(task.deadlineDate),
    deadlineTime: task.deadlineTime ?? null,
    durationMinutes: task.durationMinutes ?? null,
    recurrenceRule: task.recurrenceRule ?? null,
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
          onClose={close}
        />
      ),
  };
}
