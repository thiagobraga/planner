import { useState, useRef, useEffect } from 'react';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';

let nextId = 100;

const SEED_TASKS: Task[] = [
  { id: '1', title: 'Set up project infrastructure', priority: 1, dueDate: 'today', isCompleted: false, orderValue: 1 },
  { id: '2', title: 'Design the landing page', priority: 2, dueDate: 'tomorrow', isCompleted: false, orderValue: 2 },
  { id: '3', title: 'Write API documentation', priority: 3, dueDate: 'next monday', isCompleted: false, orderValue: 3 },
  { id: '4', title: 'Review pull requests', priority: 4, isCompleted: false, orderValue: 4 },
  { id: '5', title: 'Buy groceries', priority: 4, dueDate: 'saturday', isCompleted: false, orderValue: 5 },
];

export function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const id = String(++nextId);
    setTasks((prev) => [
      ...prev,
      { id, title: trimmed, priority: 4, isCompleted: false, orderValue: prev.length + 1 },
    ]);
    setInput('');
  };

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
    );
  };

  return (
    <div
      style={{ maxWidth: '640px', cursor: 'text' }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '22px',
          lineHeight: '24px',
          height: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
          padding: 0,
        }}
      >
        Inbox
      </h1>

      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          height: '24px',
          color: 'var(--color-ink-light)',
          margin: 0,
          padding: 0,
        }}
      >
        Capture everything, organize later
      </p>

      <div style={{ height: '24px' }} />

      <TaskList
        tasks={tasks}
        selectedTaskId={selectedId}
        onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
        onTaskToggle={handleToggle}
        onReorder={setTasks}
      />

      {/* Inline live-input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          height: '36px',
          marginTop: '4px',
        }}
      >
        <span
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '1.5px dashed var(--color-dot)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task…"
          style={{
            flex: 1,
            fontSize: '14px',
            lineHeight: '24px',
            fontFamily: '"Lora", serif',
            color: 'var(--color-ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            caretColor: 'var(--color-ink)',
          }}
        />
      </form>
    </div>
  );
}
