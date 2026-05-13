import { useState } from 'react';

interface TaskItemProps {
  title: string;
  priority?: number;
  dueDate?: string;
  isCompleted?: boolean;
  onToggle?: () => void;
}

const priorityColors: Record<number, string> = {
  1: 'var(--color-accent)',
  2: '#e67e22',
  3: '#3498db',
  4: 'var(--color-ink)',
};

export function TaskItem({ title, priority = 4, dueDate, isCompleted: initialCompleted, onToggle }: TaskItemProps) {
  const [completed, setCompleted] = useState(initialCompleted ?? false);

  const handleToggle = () => {
    setCompleted(!completed);
    onToggle?.();
  };

  return (
    <div
      onClick={handleToggle}
      onKeyDown={(e) => e.key === 'Enter' && handleToggle()}
      role="button"
      tabIndex={0}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        height: '23px',
        gap: '0px',
        cursor: 'pointer',
        opacity: completed ? 0.35 : 1,
        transition: 'opacity 150ms',
        marginBottom: '1px',
      }}
    >
      {/* Bullet or × */}
      <span
        style={{
          width: '24px',
          textAlign: 'center',
          fontSize: completed ? '24px' : '10px',
          lineHeight: '22px',
          color: priorityColors[priority],
          fontWeight: completed ? 700 : 400,
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {completed ? '×' : '•'}
      </span>

      {/* Title */}
      <span
        style={{
          fontSize: '14px',
          lineHeight: '23px',
          textDecoration: completed ? 'line-through' : 'none',
          color: completed ? 'var(--color-ink-light)' : 'var(--color-ink)',
        }}
      >
        {title}
      </span>

      {/* Due date */}
      {dueDate && (
        <span
          style={{
            fontSize: '12px',
            lineHeight: '24px',
            color: 'var(--color-ink-light)',
            fontStyle: 'italic',
            marginLeft: '6px',
          }}
        >
          {dueDate}
        </span>
      )}
    </div>
  );
}
