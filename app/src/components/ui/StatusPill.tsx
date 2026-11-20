import type { StatusPillProps, TaskStatus } from '../../types/ui';

// Tinted pills, one per status. Distinct from priority bullets and label chips.
const STATUS: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-border-subtle text-ink' },
  in_progress: { label: 'In progress', className: 'bg-info/15 text-info' },
  done: { label: 'Done', className: 'bg-success/20 text-success' },
  blocked: { label: 'Blocked', className: 'bg-danger/12 text-danger-text' },
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const { label, className: tone } = STATUS[status];
  return (
    <span
      className={`ui-status-pill inline-flex items-center text-[11px] leading-5 px-2 rounded-md whitespace-nowrap ${tone} ${className}`}
    >
      {label}
    </span>
  );
}
