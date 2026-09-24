import { useI18n } from '../i18n/I18nContext';
import { Checkbox } from './ui/Checkbox';

interface TaskVisibilityControlsProps {
  hideCompletedTasks: boolean;
  hideOldNotes: boolean;
  disabled?: boolean;
  onHideCompletedTasksChange: (value: boolean) => void;
  onHideOldNotesChange: (value: boolean) => void;
}

// Checkbox reads as "show X" - checked means visible, so it inverts the
// hide* state it is backed by.
export function TaskVisibilityControls({
  hideCompletedTasks,
  hideOldNotes,
  disabled = false,
  onHideCompletedTasksChange,
  onHideOldNotesChange,
}: TaskVisibilityControlsProps) {
  const { t } = useI18n();

  return (
    <div className="task-visibility-controls flex flex-col gap-3">
      <Checkbox
        checked={!hideCompletedTasks}
        disabled={disabled}
        onChange={(e) => onHideCompletedTasksChange(!e.target.checked)}
        label={t('visibility.completedTasks')}
      />
      <Checkbox
        checked={!hideOldNotes}
        disabled={disabled}
        onChange={(e) => onHideOldNotesChange(!e.target.checked)}
        label={t('visibility.oldNotes')}
      />
    </div>
  );
}
