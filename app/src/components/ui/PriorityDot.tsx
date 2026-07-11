export type Priority = 1 | 2 | 3 | 4;

export interface PriorityDotProps {
  /** 1–4; omit or pass undefined for the default (grey) dot. */
  priority?: Priority;
  /** Render the "P1"…"P4" label after the dot. */
  showLabel?: boolean;
  className?: string;
}

// Priority bullet colors — mirrors TaskItem's priorityClasses mapping.
const DOT_COLOR: Record<Priority, string> = {
  1: 'bg-accent',
  2: 'bg-priority-2',
  3: 'bg-priority-3',
  4: 'bg-ink',
};

export function PriorityDot({ priority, showLabel = false, className = '' }: PriorityDotProps) {
  const dot = priority ? DOT_COLOR[priority] : 'bg-dot';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      {showLabel && (
        <span className="text-xs leading-none text-ink-light">
          {priority ? `P${priority}` : 'Default'}
        </span>
      )}
    </span>
  );
}
