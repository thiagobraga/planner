import { useState, useRef, useEffect } from 'react';
import { TaskItem } from '../components/TaskItem';

const initialTasks = [
  { id: '1', title: 'Set up project infrastructure', priority: 1, dueDate: 'today' },
  { id: '2', title: 'Design the landing page', priority: 2, dueDate: 'tomorrow' },
  { id: '3', title: 'Write documentation for API endpoints', priority: 3, dueDate: 'next monday' },
  { id: '4', title: 'Review pull requests', priority: 4 },
  { id: '5', title: 'Buy groceries', priority: 4, dueDate: 'saturday' },
];

export function InboxPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      ...prev,
      { id: String(Date.now()), title: trimmed, priority: 4, dueDate: undefined as string | undefined },
    ]);
    setInput('');
  };

  return (
    <div
      style={{ maxWidth: '600px', cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Title — fits inside 24px grid row */}
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

      {/* Subtitle — next 24px row */}
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

      {/* One empty row */}
      <div style={{ height: '24px' }} />

      {/* Tasks */}
      <div>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            title={task.title}
            priority={task.priority}
            dueDate={task.dueDate}
          />
        ))}

        {/* Inline live-input */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            height: '23px',
            gap: '0px',
            marginBottom: '1px',
          }}
        >
          <span
            style={{
              width: '24px',
              textAlign: 'center',
              fontSize: '10px',
              lineHeight: '22px',
              color: 'var(--color-ink)',
              opacity: 0.35,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            •
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              flex: 1,
              fontSize: '14px',
              lineHeight: '23px',
              height: '23px',
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
    </div>
  );
}
