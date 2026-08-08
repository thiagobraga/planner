import { useRef, useEffect, memo, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Repeat } from 'lucide-react';
import { NO_DRAG_ATTR } from './dnd/sensors';
import type { TaskDragData } from '../types/drag';
import { useI18n } from '../i18n/I18nContext';
import { useTaskSelectionStore } from '../stores/taskSelectionStore';

let _pendingCol: number | null = null;
export function setPendingColumn(col: number | null): void { _pendingCol = col; }
function consumePendingColumn(): number | null { const c = _pendingCol; _pendingCol = null; return c; }

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId?: string;
  sectionId?: string;
  parentTaskId?: string;
  dueDate?: string;
  recurrenceRule?: object | null;
  isCompleted: boolean;
  orderValue: number;
  labels?: string[];
  indent?: number;
  type: 'task' | 'note';
  createdAt?: string;
}

export interface TaskItemProps {
  task: Task;
  isEditing?: boolean;
  dimmed?: boolean;
  hideDueDate?: boolean;
  dimNotes?: boolean;
  /** The list this row renders in - a collection list, or one Daily date section. */
  containerId?: string;
  /** `[task.id, ...descendantIds]`, so a drop inside the dragged block is detectable. */
  subtreeIds?: string[];
  /**
   * Depth this row would land at, set only on the row being dragged. It renders
   * as the insertion indicator, so horizontal drag previews the nesting level
   * before the drop rather than only after it.
   */
  projectedDepth?: number;
  /**
   * Depth within the list actually being rendered. Falls back to the task's
   * stored tree depth when a caller does not flatten its own rows.
   */
  renderedDepth?: number;
  /**
   * The block has left this list: the drop is heading somewhere else. The row
   * gives up its space rather than holding a slot the drop will not use.
   */
  departed?: boolean;
  /** Rendered beside the title - used on Daily, where rows span collections. */
  collectionBadge?: ReactNode;
  onToggle?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onEditCommit?: (id: string, title: string) => void;
  onEditCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddBelow?: (id: string) => void;
  onIndent?: (id: string, dir: 1 | -1) => void;
  onNavigate?: (id: string, dir: 'up' | 'down', col: number) => void;
  onConvertType?: (id: string, type: 'task' | 'note') => void;
  onRightClick?: (id: string, position: { x: number; y: number }) => void;
}

/** Shared with the drag preview, so a lifted row keeps its priority colour. */
export const priorityClasses: Record<number, string> = {
  1: 'text-accent',
  2: 'text-priority-2',
  3: 'text-priority-3',
  4: 'text-ink-light',
};

function formatDueDate(value: string, locale: 'en' | 'pt-BR'): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const currentYear = new Date().getFullYear();
  return date.toLocaleDateString(locale, {
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

/**
 * Markdown-style prefixes that switch a row's type when typed at the start of
 * the line, mirroring how the same characters read in the journal itself.
 */
const CONVERSION_MARKERS: Record<string, 'task' | 'note'> = {
  '-': 'note',
  '[': 'task',
  ']': 'task',
  '*': 'task',
};

export const TaskItem = memo(function TaskItem({
  task,
  isEditing,
  dimmed,
  hideDueDate,
  dimNotes = true,
  containerId = '',
  subtreeIds,
  projectedDepth,
  renderedDepth,
  departed,
  collectionBadge,
  onToggle,
  onStartEdit,
  onEditCommit,
  onEditCancel,
  onDelete,
  onAddBelow,
  onIndent,
  onNavigate,
  onConvertType,
  onRightClick,
}: TaskItemProps) {
  const { locale, t } = useI18n();
  const isSelected = useTaskSelectionStore((s) => s.selectedTaskIds.has(task.id));
  const selectTask = useTaskSelectionStore((s) => s.selectTask);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragData: TaskDragData = {
    kind: 'task',
    taskId: task.id,
    parentTaskId: task.parentTaskId ?? null,
    collectionId: task.collectionId ?? '',
    sectionId: task.sectionId ?? null,
    dueDate: task.dueDate ?? null,
    depth: task.indent ?? 0,
    containerId,
    subtreeIds: subtreeIds ?? [task.id],
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: dragData,
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

  const depth = projectedDepth ?? renderedDepth ?? task.indent ?? 0;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 24}px`,
    ['--row-indent' as string]: `${depth * 24}px`,
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
    } else if (e.key === '-' && e.currentTarget.value === '' && task.type !== 'note') {
      e.preventDefault();
      onConvertType?.(task.id, 'note');
    } else if (
      (e.key === '[' || e.key === ']' || e.key === '*') &&
      e.currentTarget.value === '' &&
      task.type === 'note'
    ) {
      e.preventDefault();
      onConvertType?.(task.id, 'task');
    } else if (e.key === ' ') {
      // Same conversion, but on a row that already has text: the marker only
      // counts as a prefix when it is the whole of what precedes the caret.
      const input = e.currentTarget;
      const target = CONVERSION_MARKERS[input.value[0]];
      if (input.selectionStart === 1 && input.selectionEnd === 1 && target && task.type !== target) {
        e.preventDefault();
        input.value = input.value.slice(1);
        input.setSelectionRange(0, 0);
        onConvertType?.(task.id, target);
      }
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
      {...attributes}
      {...listeners}
      className={`task-item group ${isEditing ? 'task-item--editing' : ''} ${isSelected ? 'task-item--selected bg-accent/10 rounded-xs' : ''} ${departed ? 'task-item--departed' : isDragging ? 'task-item--placeholder' : task.isCompleted || dimmed ? 'opacity-[0.35]' : ''}`}
      aria-label={task.title}
      aria-selected={isSelected}
      onClick={(e) => {
        if (isEditing) return;
        if ((e.target as HTMLElement).closest(`[${NO_DRAG_ATTR}]`)) return;
        selectTask(task.id, e.ctrlKey || e.metaKey);
      }}
      onDoubleClick={isEditing ? undefined : () => onStartEdit?.(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick?.(task.id, { x: e.clientX, y: e.clientY });
      }}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const pos = { x: touch.clientX, y: touch.clientY };
        touchTimerRef.current = setTimeout(() => {
          onRightClick?.(task.id, pos);
        }, 400);
      }}
      onTouchMove={() => {
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      }}
      onTouchEnd={() => {
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      }}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        handleRowKeyDown(e);
      }}
      role="button"
      tabIndex={isEditing ? -1 : 0}
    >
      {task.type === 'note' ? (
        <span
          aria-hidden="true"
          className="task-item-note-indicator h-6 w-6 flex items-center justify-center text-[10px] font-normal text-ink select-none shrink-0"
        >
          -
        </span>
      ) : (
        <button
          type="button"
          {...{ [NO_DRAG_ATTR]: '' }}
          aria-label={task.isCompleted
            ? t('task.reopen', { title: task.title })
            : t('task.complete', { title: task.title })}
          aria-pressed={task.isCompleted}
          onClick={(e) => { e.stopPropagation(); handleCheckClick(e); }}
          onDoubleClick={(e) => e.stopPropagation()}
          style={task.isCompleted ? {
            fontSize: 'var(--icon-check-size, 26px)',
            transform: 'translateY(var(--icon-check-offset, 0px))',
          } : {
            fontSize: 'var(--icon-dot-size, 10px)',
            transform: 'translateY(var(--icon-dot-offset, 0px))',
          }}
          className={`task-item-toggle h-6 w-6 flex items-center justify-center ${task.isCompleted ? 'font-bold' : 'font-normal'} overflow-hidden ${priorityClasses[task.priority]} select-none shrink-0 cursor-pointer bg-transparent border-0 p-0`}
        >
          {task.isCompleted ? '×' : '•'}
        </button>
      )}

      <span style={{ lineHeight: 'var(--task-line-height, 24px)' }} className="task-item-title-area flex-1 flex flex-wrap items-center min-w-0">
        {isEditing ? (
          <input
            ref={editRef}
            type="text"
            {...{ [NO_DRAG_ATTR]: '' }}
            defaultValue={task.title}
            className="task-item-title-input task-input flex-1 w-full text-sm leading-6 text-ink bg-transparent border-0 outline-none p-0"
            spellCheck={false}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
          />
        ) : (
          <>
            <span
              style={{ lineHeight: 'var(--task-line-height, 24px)' }}
              className={`task-item-title-text text-sm wrap-break-word ${task.isCompleted ? 'line-through text-ink-light' : 'text-ink'} ${task.type === 'note' && dimNotes ? 'text-ink-light' : ''}`}
            >
              {task.title}
            </span>

            {collectionBadge && (
              <span className="task-item-collection ml-1.5 shrink-0">{collectionBadge}</span>
            )}

            {task.dueDate && !hideDueDate && (
              <span className={`task-item-due-date inline-flex items-baseline gap-1 text-xs leading-6 text-ink-light ml-1.5 whitespace-nowrap`}>
                {task.recurrenceRule && <Repeat className="w-3 h-3 self-center" />}
                {formatDueDate(task.dueDate, locale)}
              </span>
            )}

            {task.labels?.map((label) => (
              <span
                key={label}
                className="task-item-label text-[10px] leading-6 px-1.5 rounded-md bg-dot text-ink ml-1 whitespace-nowrap"
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
