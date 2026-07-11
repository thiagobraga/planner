export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked';

export interface StatusPillProps {
  status: TaskStatus;
  className?: string;
}

// Tinted pills, one per status. Distinct from priority bullets and label chips.
const STATUS: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-dot text-ink' },
  in_progress: { label: 'In progress', className: 'bg-priority-3/15 text-priority-3' },
  done: { label: 'Done', className: 'bg-moss/20 text-moss' },
  blocked: { label: 'Blocked', className: 'bg-accent/12 text-accent' },
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const { label, className: tone } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center text-[11px] leading-6 px-2 rounded-[8px] whitespace-nowrap ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
