import { useMemo, useState } from 'react';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';
import { getPhrase } from '../utils/phrases';

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
      { id: 'up1', title: 'Team sync', priority: 2, dueDate: days[0].key, isCompleted: false, orderValue: 1 },
    ];
  }
  if (days[1]) {
    result[days[1].key] = [
      { id: 'up2', title: 'Deploy v0.2', priority: 1, dueDate: days[1].key, isCompleted: false, orderValue: 1 },
      { id: 'up3', title: 'Write changelog', priority: 3, dueDate: days[1].key, isCompleted: false, orderValue: 2 },
    ];
  }
  if (days[6]) {
    result[days[6].key] = [
      { id: 'up4', title: 'Weekly review', priority: 2, dueDate: days[6].key, isCompleted: false, orderValue: 1 },
    ];
  }
  return result;
};

export function UpcomingPage() {
  const days = getUpcomingDays(7);
  const phrase = useMemo(() => getPhrase('upcoming'), []);
  const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>(makeSeed);
  const [selectedId, setSelectedId] = useState<string>();

  const handleToggle = (id: string) => {
    setTasksByDay((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
      }
      return next;
    });
  };

  return (
    <div style={{ maxWidth: '648px' }}>
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '18px',
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        Upcoming
      </h1>
      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          color: 'var(--color-ink-light)',
          opacity: 0.6,
          margin: 0,
        }}
      >
        {phrase}
      </p>

      <div style={{ height: '24px' }} />

      {days.map((day) => {
        const tasks = tasksByDay[day.key] ?? [];
        return (
          <div key={day.key} style={{ marginTop: '24px' }}>
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-light)',
                fontWeight: 500,
                lineHeight: '24px',
              }}
            >
              {day.label}
            </div>
            {tasks.length > 0 ? (
              <TaskList
                tasks={tasks}
                selectedTaskId={selectedId}
                onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
                onTaskToggle={handleToggle}
                onReorder={(reordered) => setTasksByDay((prev) => ({ ...prev, [day.key]: reordered }))}
              />
            ) : (
              <div
                style={{
                  height: '24px',
                  lineHeight: '24px',
                  fontSize: '12px',
                  color: 'var(--color-ink-light)',
                  opacity: 0.4,
                  fontStyle: 'italic',
                }}
              >
                —
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
