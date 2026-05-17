import { useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  isCompleted: boolean;
  orderValue: number;
  labels?: string[];
  indent?: number;
}

export interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
  isEditing?: boolean;
  onToggle?: (id: string) => void;
  onClick?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onEditCommit?: (id: string, title: string) => void;
  onEditCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddBelow?: (id: string) => void;
  onIndent?: (id: string, dir: 1 | -1) => void;
  onNavigate?: (id: string, dir: 'up' | 'down', col: number) => void;
}

const priorityColors: Record<number, string> = {
  1: 'var(--color-accent)',
  2: '#e67e22',
  3: '#3498db',
  4: 'var(--color-ink)',
};

function formatDueDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const currentYear = new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(Number(year) !== currentYear ? { year: 'numeric' } : {}),
  });
}

function focusAdjacent(currentId: string, dir: 'up' | 'down') {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'));
  const idx = items.findIndex((el) => el.dataset.taskId === currentId);
  if (dir === 'down') {
    const next = items[idx + 1];
    if (next) next.focus();
    else document.querySelector<HTMLElement>('.task-add-input')?.focus();
  } else {
    const prev = items[idx - 1];
    if (prev) prev.focus();
  }
}

export function TaskItem({
  task,
  isSelected,
  isEditing,
  onToggle,
  onClick,
  onStartEdit,
  onEditCommit,
  onEditCancel,
  onDelete,
  onAddBelow,
  onIndent,
  onNavigate,
}: TaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const editRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      editRef.current?.focus();
      // place cursor at end
      const len = editRef.current?.value.length ?? 0;
      editRef.current?.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.isCompleted ? 0.35 : 1,
    paddingLeft: `${(task.indent ?? 0) * 20}px`,
  };

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.(task.id);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAdjacent(task.id, 'down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAdjacent(task.id, 'up');
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onStartEdit?.(task.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onAddBelow?.(task.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onIndent?.(task.id, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && !e.shiftKey)) {
      e.preventDefault();
      onDelete?.(task.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      onToggle?.(task.id);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      committedRef.current = true;
      onEditCommit?.(task.id, e.currentTarget.value);
      onAddBelow?.(task.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committedRef.current = true;
      onEditCancel?.(task.id);
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault();
      committedRef.current = true;
      onDelete?.(task.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onIndent?.(task.id, e.shiftKey ? -1 : 1);
      requestAnimationFrame(() => editRef.current?.focus());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      committedRef.current = true;
      onEditCommit?.(task.id, e.currentTarget.value);
      setTimeout(() => focusAdjacent(task.id, 'down'), 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      committedRef.current = true;
      onEditCommit?.(task.id, e.currentTarget.value);
      setTimeout(() => focusAdjacent(task.id, 'up'), 0);
    }
  };

  const handleEditBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!committedRef.current) {
      onEditCommit?.(task.id, e.target.value);
    }
    committedRef.current = false;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      className={`task-item group ${isSelected ? 'task-item--selected' : ''} ${isEditing ? 'task-item--editing' : ''}`}
      aria-label={task.title}
      aria-selected={isSelected}
      onClick={isEditing ? undefined : () => onClick?.(task.id)}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={isEditing ? -1 : 0}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="drag-handle"
        aria-label="drag to reorder"
        style={{
          position: 'absolute',
          left: '-18px',
          width: '16px',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          color: 'var(--color-ink-light)',
          fontSize: '10px',
          userSelect: 'none',
        }}
      >
        ⠿
      </span>

      {/* Toggle button */}
      <button
        type="button"
        aria-label={task.isCompleted ? `Reopen: ${task.title}` : `Complete: ${task.title}`}
        aria-pressed={task.isCompleted}
        onClick={(e) => { e.stopPropagation(); handleCheckClick(e); }}
        style={{
          width: '24px',
          textAlign: 'center',
          fontSize: task.isCompleted ? '22px' : '10px',
          lineHeight: '24px',
          overflow: 'hidden',
          color: priorityColors[task.priority],
          fontWeight: task.isCompleted ? 700 : 400,
          userSelect: 'none',
          flexShrink: 0,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
        }}
      >
        {task.isCompleted ? '×' : '•'}
      </button>

      {/* Title area */}
      <span
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          lineHeight: '24px',
          minWidth: 0,
        }}
      >
        {isEditing ? (
          <input
            ref={editRef}
            type="text"
            defaultValue={task.title}
            className="task-input"
            spellCheck={false}
            style={{
              flex: 1,
              width: '100%',
              fontSize: '14px',
              lineHeight: '24px',
              fontFamily: '"Lora", serif',
              color: 'var(--color-ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
          />
        ) : (
          <>
            <span
              style={{
                fontSize: '14px',
                lineHeight: '24px',
                textDecoration: task.isCompleted ? 'line-through' : 'none',
                color: task.isCompleted ? 'var(--color-ink-light)' : 'var(--color-ink)',
                wordBreak: 'break-word',
              }}
            >
              {task.title}
            </span>

            {task.dueDate && (
              <span
                style={{
                  fontSize: '12px',
                  lineHeight: '24px',
                  color: 'var(--color-ink-light)',
                  fontStyle: 'italic',
                  marginLeft: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDueDate(task.dueDate)}
              </span>
            )}

            {task.labels?.map((label) => (
              <span
                key={label}
                style={{
                  fontSize: '10px',
                  lineHeight: '24px',
                  padding: '0 6px',
                  borderRadius: '8px',
                  background: 'var(--color-dot)',
                  color: 'var(--color-ink)',
                  marginLeft: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                @{label}
              </span>
            ))}
          </>
        )}
      </span>
    </div>
  );
}
