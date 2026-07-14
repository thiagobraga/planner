import { useMemo, useState, useCallback } from 'react';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';
import { getPhrase } from '../utils/phrases';
import { applyIndent } from '../utils/taskTree';

function getUpcomingDays(count: number) {
  const days = [];
  const base = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: `${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}`,
    });
  }
  return days;
}

const makeSeed = (): Record<string, Task[]> => {
  const days = getUpcomingDays(7);
  const result: Record<string, Task[]> = {};
  if (days[0]) {
    result[days[0].key] = [
      { id: 'up1', title: 'Team sync', priority: 2, dueDate: days[0].key, isCompleted: false, orderValue: 1, type: 'task' },
    ];
  }
  if (days[1]) {
    result[days[1].key] = [
      { id: 'up2', title: 'Deploy v0.2', priority: 1, dueDate: days[1].key, isCompleted: false, orderValue: 1, type: 'task' },
      { id: 'up3', title: 'Write changelog', priority: 3, dueDate: days[1].key, isCompleted: false, orderValue: 2, type: 'task' },
    ];
  }
  if (days[6]) {
    result[days[6].key] = [
      { id: 'up4', title: 'Weekly review', priority: 2, dueDate: days[6].key, isCompleted: false, orderValue: 1, type: 'task' },
    ];
  }
  return result;
};

export function UpcomingPage() {
  const days = getUpcomingDays(7);
  const phrase = useMemo(() => getPhrase('upcoming'), []);
  const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>(makeSeed);
  const [selectedId, setSelectedId] = useState<string>();

  const handleTaskClick = useCallback((id: string) => {
    setSelectedId((prev) => prev === id ? undefined : id);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setTasksByDay((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
      }
      return next;
    });
  }, []);

  // Local-only: this page renders seed data with no API wiring, so indenting is
  // purely visual within its day group.
  const handleIndent = useCallback((id: string, dir: 1 | -1) => {
    setTasksByDay((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!next[key].some((t) => t.id === id)) continue;
        const { tasks, changed } = applyIndent(next[key], id, dir);
        if (changed) next[key] = tasks;
      }
      return next;
    });
  }, []);

  return (
    <div className="max-w-162">
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">
          Upcoming
        </h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
          {phrase}
        </p>
      </header>

      <div className="h-6" />

      {days.map((day) => {
        const tasks = tasksByDay[day.key] ?? [];
        return (
          <div key={day.key} className="mt-6">
            <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light font-medium leading-6">
              {day.label}
            </div>
            {tasks.length > 0 ? (
              <TaskList
                tasks={tasks}
                selectedTaskId={selectedId}
                onTaskClick={handleTaskClick}
                onTaskToggle={handleToggle}
                onIndent={handleIndent}
                onReorder={(reordered) => setTasksByDay((prev) => ({ ...prev, [day.key]: reordered }))}
              />
            ) : (
              <div className="h-6 leading-6 text-[12px] text-ink-light opacity-40 italic">
                —
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
