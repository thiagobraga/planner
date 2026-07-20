import { priorityClasses, type Task } from './TaskItem';
import { INDENT_WIDTH } from '../utils/taskProjection';

interface TaskBlockPreviewProps {
  /** The dragged row first, then its descendants in render order. */
  rows: { task: Task; depth: number }[];
}

/**
 * The dragged rows, drawn as they appear in the list, for the drag overlay.
 *
 * Deliberately not TaskItem: that row registers sortable hooks, owns edit
 * state and handles keyboard input, none of which belong to a copy floating
 * under the pointer. This renders the same shape without the behaviour, so the
 * block reads as the thing being moved and a parent visibly carries its
 * children.
 *
 * Depths are relative to the block, so a subtree dragged out of level 2 draws
 * flush rather than indented into empty space.
 */
export function TaskBlockPreview({ rows }: TaskBlockPreviewProps) {
  if (rows.length === 0) return null;
  const base = rows[0]!.depth;

  return (
    <div className="task-block-preview" aria-hidden>
      {rows.map(({ task, depth }) => (
        <div
          key={task.id}
          // Mirrors `.task-item`: same row height and same top alignment, so the
          // lifted row is the row rather than a smaller likeness of it.
          className={`task-block-preview-row task-item flex items-start ${
            task.isCompleted ? 'opacity-[0.35]' : ''
          }`}
          style={{ paddingLeft: `${Math.max(0, depth - base) * INDENT_WIDTH}px` }}
        >
          {/*
            The marker and title below repeat TaskItem's own type styles rather
            than approximating them - font, size, line height and the check/dot
            metrics all read from the same custom properties, so a change to the
            row's typography carries into the preview instead of drifting from it.
          */}
          {task.type === 'note' ? (
            <span className="w-6 text-center text-[10px] font-normal leading-6 overflow-hidden text-ink select-none shrink-0">
              -
            </span>
          ) : (
            <span
              style={
                task.isCompleted
                  ? {
                      fontSize: 'var(--icon-check-size, 26px)',
                      transform: 'translateY(var(--icon-check-offset, 0px))',
                      lineHeight: 'var(--task-line-height, 24px)',
                    }
                  : {
                      fontSize: 'var(--icon-dot-size, 10px)',
                      transform: 'translateY(var(--icon-dot-offset, 0px))',
                      lineHeight: 'var(--task-line-height, 24px)',
                    }
              }
              className={`w-6 text-center ${task.isCompleted ? 'font-bold' : 'font-normal'} overflow-hidden ${priorityClasses[task.priority]} select-none shrink-0`}
            >
              {task.isCompleted ? '×' : '•'}
            </span>
          )}

          <span
            style={{ lineHeight: 'var(--task-line-height, 24px)' }}
            className={`text-sm break-words truncate ${task.isCompleted ? 'line-through text-ink-light' : 'text-ink'}`}
          >
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}
