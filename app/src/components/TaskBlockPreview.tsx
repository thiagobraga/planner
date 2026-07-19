import type { Task } from './TaskItem';
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
          className={`task-block-preview-row flex items-center leading-6 text-[13px] text-ink ${
            task.isCompleted ? 'opacity-[0.35]' : ''
          }`}
          style={{ paddingLeft: `${Math.max(0, depth - base) * INDENT_WIDTH}px` }}
        >
          <span className="w-6 text-center text-[10px] shrink-0 select-none">
            {task.type === 'note' ? '-' : '•'}
          </span>
          <span
            className={`truncate ${task.isCompleted ? 'line-through' : ''}`}
          >
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}
