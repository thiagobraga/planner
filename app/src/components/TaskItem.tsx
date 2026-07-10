import { useRef, useEffect, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

let _pendingCol: number | null = null;
export function setPendingColumn(col: number | null): void { _pendingCol = col; }
function consumePendingColumn(): number | null { const c = _pendingCol; _pendingCol = null; return c; }

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
  createdAt?: string;
}

export interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
  isEditing?: boolean;
  hideDueDate?: boolean;
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

const priorityClasses: Record<number, string> = {
  1: 'text-accent',
  2: 'text-priority-2',
  3: 'text-priority-3',
  4: 'text-ink',
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

export const TaskItem = memo(function TaskItem({
  task,
  isSelected,
  isEditing,
  hideDueDate,
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
    if (isEditing && editRef.current) {
      editRef.current.focus();
      const pending = consumePendingColumn();
      const len = editRef.current.value.length;
      const col = pending !== null ? Math.min(pending, len) : len;
      editRef.current.setSelectionRange(col, col);
    }
  }, [isEditing]);

  // Only dnd-kit runtime values + computed indent remain inline.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${(task.indent ?? 0) * 24}px`,
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
      const col = e.currentTarget.selectionStart ?? 0;
      committedRef.current = true;
      onEditCommit?.(task.id, e.currentTarget.value);
      onNavigate?.(task.id, 'down', col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const col = e.currentTarget.selectionStart ?? 0;
      committedRef.current = true;
      onEditCommit?.(task.id, e.currentTarget.value);
      onNavigate?.(task.id, 'up', col);
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
      className={`task-item group ${isSelected ? 'task-item--selected' : ''} ${isEditing ? 'task-item--editing' : ''} ${isDragging ? 'opacity-50' : task.isCompleted ? 'opacity-[0.35]' : ''}`}
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
        className="drag-handle absolute left-[-18px] w-4 cursor-grab flex items-center justify-center opacity-0 text-ink-light text-[10px] select-none"
        aria-label="drag to reorder"
      >
        ⠿
      </span>

      {/* Toggle button */}
      <button
        type="button"
        aria-label={task.isCompleted ? `Reopen: ${task.title}` : `Complete: ${task.title}`}
        aria-pressed={task.isCompleted}
        onClick={(e) => { e.stopPropagation(); handleCheckClick(e); }}
        className={`w-6 text-center ${task.isCompleted ? 'text-[26px] font-bold' : 'text-[10px] font-normal'} leading-6 overflow-hidden ${priorityClasses[task.priority]} select-none shrink-0 cursor-pointer bg-transparent border-0 p-0`}
      >
        {task.isCompleted ? '×' : '•'}
      </button>

      {/* Title area */}
      <span className="flex-1 flex flex-wrap items-baseline leading-6 min-w-0">
        {isEditing ? (
          <input
            ref={editRef}
            type="text"
            defaultValue={task.title}
            className="task-input flex-1 w-full text-sm leading-6 text-ink bg-transparent border-0 outline-none p-0"
            spellCheck={false}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
          />
        ) : (
          <>
            <span
              className={`text-sm leading-6 break-words ${task.isCompleted ? 'line-through text-ink-light' : 'text-ink'}`}
            >
              {task.title}
            </span>

            {task.dueDate && !hideDueDate && (
              <span className="text-xs leading-6 text-ink-light italic ml-1.5 whitespace-nowrap">
                {formatDueDate(task.dueDate)}
              </span>
            )}

            {task.labels?.map((label) => (
              <span
                key={label}
                className="text-[10px] leading-6 px-1.5 rounded-[8px] bg-dot text-ink ml-1 whitespace-nowrap"
              >
                @{label}
              </span>
            ))}
          </>
        )}
      </span>
    </div>
  );
});
