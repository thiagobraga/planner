import { useI18n } from '../i18n/I18nContext';
import { Checkbox } from './ui/Checkbox';

interface TaskVisibilityControlsProps {
  hideCompletedTasks: boolean;
  showNotes: boolean;
  disabled?: boolean;
  onHideCompletedTasksChange: (value: boolean) => void;
  onShowNotesChange: (value: boolean) => void;
}

// Each checkbox reads as "show X" - checked means visible. hideCompletedTasks
// is stored as a hide* flag so it inverts; showNotes already matches the
// checkbox polarity directly.
export function TaskVisibilityControls({
  hideCompletedTasks,
  showNotes,
  disabled = false,
  onHideCompletedTasksChange,
  onShowNotesChange,
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
        checked={showNotes}
        disabled={disabled}
        onChange={(e) => onShowNotesChange(e.target.checked)}
        label={t('visibility.notes')}
      />
    </div>
  );
}
