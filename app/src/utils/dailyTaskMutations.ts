import type { DaySection } from '../types/daily';
import type { Task } from '../types/task';
import { dateFromISO, dayLabel } from './dailySections';
import { nextOrderValue } from './order';

let tempCounter = 0;
export function nextDailyTempId(): string {
  return `temp-daily-${++tempCounter}`;
}

export function calculateMidpointOrder(tasks: Task[], index: number, type: 'above' | 'below'): number {
  const current = tasks[index].orderValue;
  if (type === 'below') {
    const next = index < tasks.length - 1 ? tasks[index + 1].orderValue : current + 2000;
    return Math.floor((current + next) / 2);
  }
  const prev = index > 0 ? tasks[index - 1].orderValue : current - 2000;
  return Math.floor((prev + current) / 2);
}

export function removeDailyTask(sections: DaySection[], taskId: string): DaySection[] {
  return sections.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }));
}

export function patchDailyTask(
  sections: DaySection[],
  taskId: string,
  patch: Partial<Task>,
): DaySection[] {
  return sections.map((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  }));
}

export function replaceTempRowWithCreated(
  sections: DaySection[],
  tempId: string,
  createdTask: Task,
): DaySection[] {
  return sections.map((s) => ({
    ...s,
    tasks: s.tasks
      .filter((t) => t.id !== createdTask.id || t.id === tempId)
      .map((t) => (t.id === tempId ? createdTask : t)),
  }));
}

export function insertAdjacentDailyRow(
  sections: DaySection[],
  anchorId: string,
  direction: 'above' | 'below',
  tid: string,
): DaySection[] {
  return sections.map((s) => {
    const idx = s.tasks.findIndex((t) => t.id === anchorId);
    if (idx === -1) return s;
    const computedOrderValue = calculateMidpointOrder(s.tasks, idx, direction);
    const next = [...s.tasks];
    const insertIndex = direction === 'below' ? idx + 1 : idx;
    next.splice(insertIndex, 0, {
      id: tid,
      title: '',
      priority: 4,
      isCompleted: false,
      orderValue: computedOrderValue,
      indent: s.tasks[idx]?.indent,
      type: 'task',
    });
    return { ...s, tasks: next };
  });
}

export function appendTodayRow(
  sections: DaySection[],
  todayKey: string,
  tid: string,
  title: string,
  orderValue: number,
): DaySection[] {
  return sections.map((s) =>
    s.key === todayKey
      ? {
          ...s,
          tasks: [
            ...s.tasks,
            {
              id: tid,
              title,
              priority: 4,
              isCompleted: false,
              orderValue,
              type: 'task',
            },
          ],
        }
      : s,
  );
}

export function appendTodayNoteRow(
  sections: DaySection[],
  todayKey: string,
  tid: string,
  locale: 'en' | 'pt-BR',
  dateFormat?: string,
): DaySection[] {
  const withToday = sections.some((s) => s.key === todayKey)
    ? sections
    : [
        ...sections,
        {
          key: todayKey,
          label: dayLabel(dateFromISO(todayKey), locale, dateFormat),
          tasks: [],
        },
      ];

  return withToday.map((s) =>
    s.key === todayKey
      ? {
          ...s,
          tasks: [
            ...s.tasks,
            {
              id: tid,
              title: '',
              priority: 4,
              dueDate: todayKey,
              isCompleted: false,
              orderValue: nextOrderValue(s.tasks),
              type: 'note',
            },
          ],
        }
      : s,
  );
}

export function appendFutureRow(
  sections: DaySection[],
  dateKey: string,
  row: Task,
  locale: 'en' | 'pt-BR',
  dateFormat: string,
): DaySection[] {
  return sections.some((s) => s.key === dateKey)
    ? sections.map((s) => (s.key === dateKey ? { ...s, tasks: [...s.tasks, row] } : s))
    : [...sections, { key: dateKey, label: dayLabel(dateFromISO(dateKey), locale, dateFormat), tasks: [row] }];
}
