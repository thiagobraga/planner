import { useRef, useEffect, memo, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Repeat } from 'lucide-react';
import { NO_DRAG_ATTR } from './dnd/sensors';
import { isTaskDrag, type TaskDragData } from '../types/drag';
import { useI18n } from '../i18n/I18nContext';
import { useTaskSelectionStore } from '../stores/taskSelectionStore';
import { usePlannerDrag } from '../contexts/usePlannerDrag';
import { priorityClasses } from './taskPriorityClasses';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  collectionId?: string;
  sectionId?: string;
  statusId?: string | null;
  parentTaskId?: string;
  dueDate?: string;
  recurrenceRule?: object | null;
  isCompleted: boolean;
  orderValue: number;
  labels?: string[];
  indent?: number;
  type: 'task' | 'note';
  createdAt?: string;
  /** Set on Reorganize preview rows whose due date would change, for a highlight. */
  moved?: boolean;
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
  onConvertType?: (id: string, type: 'task' | 'note') => void;
  onRightClick?: (id: string, position: { x: number; y: number }) => void;
}

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
  onConvertType,
  onRightClick,
}: TaskItemProps) {
  const { locale, t } = useI18n();
  const isSelected = useTaskSelectionStore((s) => s.selectedTaskIds.has(task.id));
  const selectTask = useTaskSelectionStore((s) => s.selectTask);
  const { activeDrag, hasMoved, overId } = usePlannerDrag();
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
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
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
    if (e.key === 'Enter' && e.shiftKey) {
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
      className={`task-item group ${isEditing ? 'task-item--editing' : ''} ${isSelected ? 'task-item--selected' : ''} ${departed ? 'task-item--departed' : isDragging ? 'task-item--placeholder' : task.isCompleted || dimmed ? 'opacity-[0.35]' : ''}`}
      aria-label={task.title}
      aria-selected={isSelected}
      onClick={(e) => {
        if (isEditing) return;
        if ((e.target as HTMLElement).closest(`[${NO_DRAG_ATTR}]`)) return;
        selectTask(task.id, e.ctrlKey || e.metaKey);
      }}
      onPointerUp={(e) => {
        // Activation is distance-based (see PRESS_ACTIVATION in dnd/sensors.ts),
        // so a stationary click never activates dnd-kit and this branch is a
        // no-op for the common case - native onClick above handles it. This is
        // a safety net for the rarer gesture that crosses the activation
        // distance and then settles back near its origin before release: once
        // activated, dnd-kit swallows the click that would otherwise follow it
        // (stopPropagation on the next document click, see AbstractPointerSensor
        // .handleStart in @dnd-kit/core), so selecting here - pointerup is
        // never swallowed - is what keeps that gesture selecting too.
        if (isEditing) return;
        if ((e.target as HTMLElement).closest(`[${NO_DRAG_ATTR}]`)) return;
        const drag = activeDrag ?? undefined;
        // overId only moves to another droppable once collision detection
        // actually picks a different target - a container included, per
        // plannerCollisionDetection's end-of-list resolution - so this still
        // catches a settled-back gesture that resolves onto something other
        // than this row without meaning to.
        const stayedOnSelf = overId === null || overId === task.id;
        if (isTaskDrag(drag) && drag.taskId === task.id && (!hasMoved || stayedOnSelf)) {
          selectTask(task.id, e.ctrlKey || e.metaKey);
        }
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
          } : undefined}
          className={`task-item-toggle h-6 w-6 flex items-center justify-center ${task.isCompleted ? 'font-bold' : ''} overflow-hidden ${priorityClasses[task.priority]} select-none shrink-0 cursor-pointer bg-transparent border-0 p-0`}
        >
          {task.isCompleted ? '×' : (
            // A drawn shape, not a font glyph: a bullet character's optical
            // center shifts with font hinting/rendering, which is exactly what
            // put the dot visibly off-center from the title text next to it.
            <span aria-hidden="true" className="block w-[3px] h-[3px] rounded-full bg-current" />
          )}
        </button>
      )}

      <span className="task-item-title-area flex-1 flex flex-wrap items-center min-w-0">
        {isEditing ? (
          <input
            ref={editRef}
            type="text"
            {...{ [NO_DRAG_ATTR]: '' }}
            defaultValue={task.title}
            className="task-item-title-input task-input flex-1 w-full h-6 text-sm text-ink bg-transparent border-0 outline-none p-0"
            spellCheck={false}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
          />
        ) : (
          <>
            <span
              className={`task-item-title-text flex items-center min-h-6 text-sm wrap-break-word ${task.isCompleted ? 'line-through text-ink-light' : 'text-ink'} ${task.type === 'note' && dimNotes ? 'text-ink-light' : ''}`}
            >
              {task.title}
            </span>

            {collectionBadge && (
              <span className="task-item-collection h-6 flex items-center ml-1.5 shrink-0">{collectionBadge}</span>
            )}

            {task.dueDate && !hideDueDate && (
              <span className="task-item-due-date h-6 inline-flex items-center gap-1 text-xs text-ink-light ml-1.5 whitespace-nowrap">
                {task.recurrenceRule && <Repeat className="w-3 h-3" />}
                {formatDueDate(task.dueDate, locale)}
              </span>
            )}

            {task.labels?.map((label) => (
              <span
                key={label}
                className="task-item-label h-6 flex items-center text-[10px] px-1.5 rounded-md bg-dot text-ink ml-1 whitespace-nowrap"
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
