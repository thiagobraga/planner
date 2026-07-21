import { Eye, EyeOff, FileClock } from 'lucide-react';

interface TaskVisibilityControlsProps {
  hideCompletedTasks: boolean;
  hideOldNotes: boolean;
  disabled?: boolean;
  onHideCompletedTasksChange: (value: boolean) => void;
  onHideOldNotesChange: (value: boolean) => void;
}

function controlClass(active: boolean): string {
  return `inline-flex h-6 w-6 items-center justify-center transition-colors duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-40 ${
    active
      ? 'bg-dot/60 text-ink'
      : 'bg-transparent text-ink-light hover:bg-dot/30'
  }`;
}

export function TaskVisibilityControls({
  hideCompletedTasks,
  hideOldNotes,
  disabled = false,
  onHideCompletedTasksChange,
  onHideOldNotesChange,
}: TaskVisibilityControlsProps) {
  const completedLabel = hideCompletedTasks ? 'Show completed tasks' : 'Hide completed tasks';
  const oldNotesLabel = hideOldNotes ? 'Show old notes' : 'Hide old notes';

  return (
    <div className="task-visibility-controls inline-flex h-6 items-center overflow-hidden rounded-[2px] border border-border">
      <button
        type="button"
        aria-label={completedLabel}
        aria-pressed={hideCompletedTasks}
        title={completedLabel}
        disabled={disabled}
        onClick={() => onHideCompletedTasksChange(!hideCompletedTasks)}
        className={controlClass(hideCompletedTasks)}
      >
        {hideCompletedTasks ? (
          <Eye size={14} strokeWidth={1.8} />
        ) : (
          <EyeOff size={14} strokeWidth={1.8} />
        )}
      </button>
      <button
        type="button"
        aria-label={oldNotesLabel}
        aria-pressed={hideOldNotes}
        title={oldNotesLabel}
        disabled={disabled}
        onClick={() => onHideOldNotesChange(!hideOldNotes)}
        className={`${controlClass(hideOldNotes)} border-l border-border`}
      >
        <FileClock size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
