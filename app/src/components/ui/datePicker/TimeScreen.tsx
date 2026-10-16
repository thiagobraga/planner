import { CalendarDays, ChevronRight, Clock, Flag, Repeat } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { TaskSchedule } from '../../../types/task';
import { fmtISO } from '../../../utils/date';
import { parseISODate } from '../../../utils/dateQuickOptions';
import { recurrenceSummary } from '../../../utils/recurrenceSummary';
import { addMinutes } from '../../../utils/taskTime';
import { Button } from '../Button';
import { Toggle } from '../Toggle';
import { DURATION_OPTIONS, DURATION_PRESETS, formatDurationLabel } from './durations';
import { Divider, ICON, ScreenHeader, SectionLabel, bareInput, fieldShell } from './parts';

interface TimeScreenProps {
  draft: TaskSchedule;
  onChange: (patch: Partial<TaskSchedule>) => void;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenRepeat: () => void;
  onClose: () => void;
}

export function TimeScreen({ draft, onChange, onBack, onCancel, onSave, onOpenRepeat, onClose }: TimeScreenProps) {
  const { t, locale } = useI18n();
  const hasDeadline = draft.deadlineDate !== null;

  const dateHeading = draft.dueDate
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISODate(draft.dueDate))
    : t('datePicker.noDate');

  const durationOptions = [...DURATION_OPTIONS] as number[];
  if (draft.durationMinutes && !durationOptions.includes(draft.durationMinutes)) {
    durationOptions.push(draft.durationMinutes);
    durationOptions.sort((a, b) => a - b);
  }

  const label = 'mb-1 block text-[13px] text-ink-light';

  return (
    <>
      <ScreenHeader title={t('datePicker.timeTitle')} onBack={onBack} onClose={onClose} />

      <div className="flex h-8 items-center gap-3 px-3 pb-3 text-[14px] text-ink">
        <CalendarDays {...ICON} className="shrink-0 text-ink-light" />
        <span className="first-letter:uppercase">{dateHeading}</span>
      </div>

      <Divider />

      <section className="flex flex-col gap-2 p-3" aria-labelledby="task-date-picker-time-section">
        <div className="flex items-center justify-between">
          <SectionLabel id="task-date-picker-time-section">{t('datePicker.time')}</SectionLabel>
          {draft.dueTime && (
            <button
              type="button"
              onClick={() => onChange({ dueTime: null })}
              className="h-6 cursor-pointer border-none bg-transparent p-0 text-[12px] text-ink-light hover:text-ink"
            >
              {t('datePicker.removeTime')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-date-picker-start" className={label}>{t('datePicker.start')}</label>
            <div className={fieldShell}>
              <Clock {...ICON} className="shrink-0 text-ink-light" />
              <input
                id="task-date-picker-start"
                type="time"
                value={draft.dueTime ?? ''}
                disabled={!draft.dueDate}
                onChange={(e) => onChange({ dueTime: e.target.value || null })}
                className={`${bareInput} tabular-nums`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="task-date-picker-duration" className={label}>{t('datePicker.length')}</label>
            <div className={fieldShell}>
              <Clock {...ICON} className="shrink-0 text-ink-light" />
              <select
                id="task-date-picker-duration"
                value={draft.durationMinutes ?? ''}
                onChange={(e) => onChange({ durationMinutes: e.target.value ? Number(e.target.value) : null })}
                className={`${bareInput} cursor-pointer appearance-none`}
              >
                <option value="">{t('datePicker.noDuration')}</option>
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>{formatDurationLabel(minutes)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label={t('datePicker.length')}>
          {DURATION_PRESETS.map((minutes) => {
            const active = draft.durationMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ durationMinutes: active ? null : minutes })}
                className={`h-8 cursor-pointer rounded-xs border text-[13px] text-ink transition-colors duration-(--motion-fast) active:scale-[0.98] ${
                  active ? 'border-ink bg-dot/40' : 'border-border bg-(--planner-control-bg) hover:border-ink-lighter'
                }`}
              >
                {formatDurationLabel(minutes)}
              </button>
            );
          })}
        </div>
        <p className="m-0 h-6 text-[12px] leading-6 text-ink-light" aria-live="polite">
          {draft.dueTime && draft.durationMinutes
            ? t('datePicker.endsAt', { time: addMinutes(draft.dueTime, draft.durationMinutes) })
            : null}
        </p>
      </section>

      <Divider />

      <section className="flex flex-col gap-2 p-3" aria-labelledby="task-date-picker-deadline-section">
        <SectionLabel id="task-date-picker-deadline-section">{t('datePicker.deadline')}</SectionLabel>
        <div className="flex h-8 items-center gap-3">
          <Flag {...ICON} className="shrink-0 text-ink-light" />
          <Toggle
            className="flex-1 flex-row-reverse justify-between"
            checked={hasDeadline}
            label={t('datePicker.setDeadline')}
            onChange={(on) =>
              onChange(
                on
                  ? { deadlineDate: draft.dueDate ?? fmtISO(new Date()) }
                  : { deadlineDate: null, deadlineTime: null },
              )
            }
          />
        </div>
        {hasDeadline && (
          <div className="date-picker-reveal grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-date-picker-deadline-date" className={label}>{t('datePicker.date')}</label>
              <div className={fieldShell}>
                <input
                  id="task-date-picker-deadline-date"
                  type="date"
                  aria-label={t('datePicker.deadlineDate')}
                  value={draft.deadlineDate ?? ''}
                  onChange={(e) => onChange({ deadlineDate: e.target.value || null, ...(e.target.value ? {} : { deadlineTime: null }) })}
                  className={`${bareInput} tabular-nums`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="task-date-picker-deadline-time" className={label}>{t('datePicker.time')}</label>
              <div className={fieldShell}>
                <input
                  id="task-date-picker-deadline-time"
                  type="time"
                  aria-label={t('datePicker.deadlineTime')}
                  value={draft.deadlineTime ?? ''}
                  onChange={(e) => onChange({ deadlineTime: e.target.value || null })}
                  className={`${bareInput} tabular-nums`}
                />
              </div>
            </div>
          </div>
        )}
        <p className="m-0 text-[12px] leading-6 text-ink-light">{t('datePicker.independent')}</p>
      </section>

      <Divider />

      <button
        type="button"
        onClick={onOpenRepeat}
        className="mx-3 my-2 flex h-8 cursor-pointer items-center gap-3 rounded-xs border-none bg-transparent px-0 text-left text-[14px] text-ink transition-colors duration-(--motion-fast) hover:bg-dot/30"
        style={{ width: 'calc(100% - 24px)' }}
      >
        <Repeat {...ICON} className="shrink-0 text-ink-light" />
        <span className="flex-1">{t('datePicker.repetition')}</span>
        <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink-light">
          <span className="truncate">
            {draft.recurrenceRule ? recurrenceSummary(draft.recurrenceRule, locale) : t('recurrence.none')}
          </span>
          <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </button>

      <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-3">
        <Button variant="tertiary" size="md" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="primary" size="md" onClick={onSave} className="min-w-24">{t('common.save')}</Button>
      </div>
    </>
  );
}
