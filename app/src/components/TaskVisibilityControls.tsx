import { Eye, EyeOff, FileClock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { ButtonGroup } from './ui/ButtonGroup';

interface TaskVisibilityControlsProps {
  hideCompletedTasks: boolean;
  hideOldNotes: boolean;
  disabled?: boolean;
  onHideCompletedTasksChange: (value: boolean) => void;
  onHideOldNotesChange: (value: boolean) => void;
}

type VisibilityToggle = 'completed' | 'oldNotes';

export function TaskVisibilityControls({
  hideCompletedTasks,
  hideOldNotes,
  disabled = false,
  onHideCompletedTasksChange,
  onHideOldNotesChange,
}: TaskVisibilityControlsProps) {
  const { t } = useI18n();
  const completedLabel = hideCompletedTasks ? t('visibility.showCompleted') : t('visibility.hideCompleted');
  const oldNotesLabel = hideOldNotes ? t('visibility.showOldNotes') : t('visibility.hideOldNotes');

  const value: VisibilityToggle[] = [
    ...(hideCompletedTasks ? (['completed'] as const) : []),
    ...(hideOldNotes ? (['oldNotes'] as const) : []),
  ];

  return (
    <ButtonGroup
      mode="multi"
      value={value}
      disabled={disabled}
      className="task-visibility-controls"
      onChange={(clicked) => {
        if (clicked === 'completed') onHideCompletedTasksChange(!hideCompletedTasks);
        else onHideOldNotesChange(!hideOldNotes);
      }}
      items={[
        {
          value: 'completed',
          label: completedLabel,
          icon: hideCompletedTasks ? <Eye size={12} strokeWidth={1.8} /> : <EyeOff size={12} strokeWidth={1.8} />,
        },
        {
          value: 'oldNotes',
          label: oldNotesLabel,
          icon: <FileClock size={12} strokeWidth={1.8} />,
        },
      ]}
    />
  );
}
