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
}

interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
  onToggle?: (id: string) => void;
  onClick?: (id: string) => void;
}

const priorityColors: Record<number, string> = {
  1: 'var(--color-accent)',
  2: '#e67e22',
  3: '#3498db',
  4: 'var(--color-ink)',
};

const priorityLabels: Record<number, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: '',
};

export function TaskItem({ task, isSelected, onToggle, onClick }: TaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.(task.id);
  };

  const handleRowClick = () => {
    onClick?.(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      className={`task-item group ${isSelected ? 'task-item--selected' : ''}`}
      aria-selected={isSelected}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="drag-handle"
        aria-label="drag to reorder"
        style={{
          width: '16px',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          color: 'var(--color-ink-light)',
          fontSize: '10px',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        ⠿
      </span>

      {/* Checkbox */}
      <button
        type="button"
        aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
        onClick={handleCheckClick}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: `1.5px solid ${priorityColors[task.priority]}`,
          background: task.isCompleted ? priorityColors[task.priority] : 'transparent',
          flexShrink: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        {task.isCompleted && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title + metadata */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
        style={{
          flex: 1,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontSize: '14px',
              lineHeight: '24px',
              color: task.isCompleted ? 'var(--color-ink-light)' : 'var(--color-ink)',
              textDecoration: task.isCompleted ? 'line-through' : 'none',
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {task.title}
          </span>

          {task.priority < 4 && (
            <span
              style={{
                fontSize: '10px',
                lineHeight: '24px',
                color: priorityColors[task.priority],
                fontWeight: 600,
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {priorityLabels[task.priority]}
            </span>
          )}
        </div>

        {(task.dueDate || (task.labels && task.labels.length > 0)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '0px',
            }}
          >
            {task.dueDate && (
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: '18px',
                  color: 'var(--color-ink-light)',
                  fontStyle: 'italic',
                }}
              >
                {task.dueDate}
              </span>
            )}
            {task.labels?.map((label) => (
              <span
                key={label}
                style={{
                  fontSize: '10px',
                  lineHeight: '16px',
                  padding: '0 6px',
                  borderRadius: '8px',
                  background: 'var(--color-dot)',
                  color: 'var(--color-ink)',
                }}
              >
                @{label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
