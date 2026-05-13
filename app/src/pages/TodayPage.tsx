import { useState } from 'react';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';

const SEED: Task[] = [
  { id: 't1', title: 'Morning standup', priority: 2, dueDate: 'today', isCompleted: false, orderValue: 1 },
  { id: 't2', title: 'Code review for auth service', priority: 1, dueDate: 'today', isCompleted: false, orderValue: 2 },
  { id: 't3', title: 'Update project README', priority: 4, dueDate: 'today', isCompleted: true, orderValue: 3 },
];

const OVERDUE_SEED: Task[] = [
  { id: 'ov1', title: 'Submit expense report', priority: 1, dueDate: 'yesterday', isCompleted: false, orderValue: 0 },
];

export function TodayPage() {
  const [overdue, setOverdue] = useState<Task[]>(OVERDUE_SEED);
  const [today, setToday] = useState<Task[]>(SEED);
  const [selectedId, setSelectedId] = useState<string>();

  const handleToggle = (id: string) => {
    setOverdue((prev) => prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)));
    setToday((prev) => prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)));
  };

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '22px',
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        Today
      </h1>
      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          color: 'var(--color-ink-light)',
          margin: 0,
          fontStyle: 'italic',
        }}
      >
        {dateLabel}
      </p>

      {overdue.length > 0 && (
        <>
          <div style={{ height: '24px' }} />
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            Overdue
          </div>
          <TaskList
            tasks={overdue}
            selectedTaskId={selectedId}
            onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
            onTaskToggle={handleToggle}
            onReorder={setOverdue}
          />
        </>
      )}

      <div style={{ height: '24px' }} />
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-light)',
          marginBottom: '8px',
          fontWeight: 500,
        }}
      >
        Today
      </div>
      <TaskList
        tasks={today}
        selectedTaskId={selectedId}
        onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
        onTaskToggle={handleToggle}
        onReorder={setToday}
      />
    </div>
  );
}
