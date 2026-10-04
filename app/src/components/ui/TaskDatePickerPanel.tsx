import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/catalogs';
import type { TaskSchedule } from '../../types/task';
import { Button } from './Button';

interface TaskDatePickerPanelProps {
  value: TaskSchedule;
  onSave: (value: TaskSchedule) => void;
}

const EMPTY: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  deadlineDate: null,
  deadlineTime: null,
  durationMinutes: null,
};

const inputClass =
  'w-full h-6 px-1.5 text-[13px] text-ink bg-transparent border border-border rounded-xs outline-none focus:border-ink disabled:opacity-40';

export function TaskDatePickerPanel({ value, onSave }: TaskDatePickerPanelProps) {
  const { t } = useI18n();
  const [dueDate, setDueDate] = useState(value.dueDate ?? '');
  const [dueTime, setDueTime] = useState(value.dueTime ?? '');
  const [deadlineDate, setDeadlineDate] = useState(value.deadlineDate ?? '');
  const [deadlineTime, setDeadlineTime] = useState(value.deadlineTime ?? '');
  const [duration, setDuration] = useState(value.durationMinutes ? String(value.durationMinutes) : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    onSave({
      dueDate: dueDate || null,
      dueTime: dueDate && dueTime ? dueTime : null,
      deadlineDate: deadlineDate || null,
      deadlineTime: deadlineDate && deadlineTime ? deadlineTime : null,
      durationMinutes: Number.isInteger(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null,
    });
  };

  const field = (id: string, labelKey: TranslationKey, input: React.ReactNode) => (
    <label htmlFor={id} className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] tracking-[0.08em] uppercase text-ink-light">{t(labelKey)}</span>
      {input}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="task-date-picker w-72 p-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {field('task-date-picker-date', 'datePicker.date',
          <input id="task-date-picker-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />)}
        {field('task-date-picker-time', 'datePicker.time',
          <input id="task-date-picker-time" type="time" value={dueTime} disabled={!dueDate} onChange={(e) => setDueTime(e.target.value)} className={inputClass} />)}
        {field('task-date-picker-deadline', 'datePicker.deadline',
          <input id="task-date-picker-deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className={inputClass} />)}
        {field('task-date-picker-deadline-time', 'datePicker.deadlineTime',
          <input id="task-date-picker-deadline-time" type="time" value={deadlineTime} disabled={!deadlineDate} onChange={(e) => setDeadlineTime(e.target.value)} className={inputClass} />)}
        {field('task-date-picker-duration', 'datePicker.duration',
          <input id="task-date-picker-duration" type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} />)}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="tertiary" onClick={() => onSave(EMPTY)}>
          {t('datePicker.clear')}
        </Button>
        <Button size="sm" variant="primary" type="submit">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
