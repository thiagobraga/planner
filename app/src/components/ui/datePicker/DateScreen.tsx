import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarRange, ChevronRight, Clock, CornerDownLeft, Flag, Repeat, Sun, Sunrise } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/catalogs';
import { apiParseDate } from '../../../api/client';
import type { ParsedDateInput, TaskSchedule } from '../../../types/task';
import type { WeekStart } from '../../../utils/date';
import { dateQuickOptions, formatShortDay, type DateQuickOptionKey } from '../../../utils/dateQuickOptions';
import { recurrenceSummary } from '../../../utils/recurrenceSummary';
import { formatDurationLabel } from './durations';
import { Button } from '../Button';
import { MonthCalendar } from '../MonthCalendar';
import { Divider, ICON, ScreenHeader, bareInput, fieldShell } from './parts';

const QUICK_ICONS: Record<DateQuickOptionKey, typeof Sun> = {
  today: Sun,
  tomorrow: Sunrise,
  weekend: CalendarRange,
  nextWeek: ArrowRight,
};

const QUICK_LABELS: Record<DateQuickOptionKey, TranslationKey> = {
  today: 'datePicker.today',
  tomorrow: 'datePicker.tomorrow',
  weekend: 'datePicker.weekend',
  nextWeek: 'datePicker.nextWeek',
};

type Preview = { status: 'idle' | 'none' } | { status: 'found'; result: ParsedDateInput };

const PARSE_DELAY_MS = 250;

// Focusing on a touch screen would raise the keyboard over the calendar.
function focusOnFinePointer(input: HTMLInputElement | null) {
  if (input && window.matchMedia?.('(pointer: fine)').matches) input.focus({ preventScroll: true });
}

interface DateScreenProps {
  draft: TaskSchedule;
  onChange: (patch: Partial<TaskSchedule>) => void;
  weekStart: WeekStart;
  onOpenTime: (focusDeadline: boolean) => void;
  onOpenRepeat: () => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function DateScreen({ draft, onChange, weekStart, onOpenTime, onOpenRepeat, onSave, onRemove, onClose }: DateScreenProps) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  // The verdict for one query; a stale one (text changed since) reads as idle.
  const [parsed, setParsed] = useState<{ query: string; preview: Preview }>({ query: '', preview: { status: 'idle' } });
  const query = text.trim();
  const preview: Preview = query && parsed.query === query ? parsed.preview : { status: 'idle' };
  const quickOptions = useMemo(() => dateQuickOptions(new Date(), weekStart), [weekStart]);
  // Remount the calendar on a date picked elsewhere so it pages to that month.
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiParseDate(query, locale, controller.signal)
        .then((result) => setParsed({ query, preview: result ? { status: 'found', result } : { status: 'none' } }))
        // A failed request says nothing about the text, so show no verdict rather than "not understood".
        .catch(() => setParsed({ query, preview: { status: 'idle' } }));
    }, PARSE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const pickDate = (date: string, jumpCalendar: boolean) => {
    onChange({ dueDate: date });
    if (jumpCalendar) setCalendarKey((key) => key + 1);
  };

  const applyTyped = () => {
    if (preview.status !== 'found') return;
    const { date, time, recurrence } = preview.result;
    onChange({
      dueDate: date,
      ...(time ? { dueTime: time } : {}),
      ...(recurrence ? { recurrenceRule: recurrence } : {}),
    });
    setCalendarKey((key) => key + 1);
    setText('');
  };

  const timeLabel = draft.dueTime
    ? [draft.dueTime, draft.durationMinutes ? formatDurationLabel(draft.durationMinutes) : null].filter(Boolean).join(' · ')
    : t('datePicker.addTime');
  const repeatLabel = draft.recurrenceRule ? recurrenceSummary(draft.recurrenceRule, locale) : t('datePicker.repeat');
  const deadlineLabel = draft.deadlineDate
    ? [formatShortDay(draft.deadlineDate, locale), draft.deadlineTime].filter(Boolean).join(', ')
    : t('datePicker.add');

  const chip =
    'flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-xs border border-border bg-(--planner-control-bg) px-2 text-left text-[12px] text-ink transition-colors duration-(--motion-fast) hover:border-ink-lighter hover:bg-(--planner-control-bg-hover)';

  return (
    <>
      <ScreenHeader title={t('datePicker.title')} icon={<CalendarDays {...ICON} />} onClose={onClose} />

      <div className="flex flex-col gap-3 px-3 pb-3">
        <div>
          <label className={fieldShell}>
            <CalendarDays {...ICON} className="shrink-0 text-ink-light" />
            <input
              type="text"
              value={text}
              ref={focusOnFinePointer}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyTyped();
                }
              }}
              placeholder={t('datePicker.typePlaceholder')}
              aria-label={t('datePicker.typeAria')}
              aria-describedby="task-date-picker-preview"
              className={bareInput}
            />
          </label>
          <div id="task-date-picker-preview" aria-live="polite" className="min-h-0">
            {preview.status === 'found' && (
              <button
                type="button"
                onClick={applyTyped}
                className="date-picker-preview mt-1 flex h-6 w-full cursor-pointer items-center gap-2 rounded-xs border-none bg-transparent px-2 text-left text-[12px] text-ink hover:bg-dot/30"
              >
                <span className="min-w-0 flex-1 truncate">
                  {[
                    formatShortDay(preview.result.date, locale),
                    preview.result.time,
                    preview.result.recurrence ? recurrenceSummary(preview.result.recurrence, locale) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-ink-light">
                  <CornerDownLeft size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span className="sr-only">{t('datePicker.enterToApply')}</span>
                </span>
              </button>
            )}
            {preview.status === 'none' && (
              <p className="date-picker-preview m-0 mt-1 h-6 px-2 text-[12px] leading-6 text-ink-light">{t('datePicker.notUnderstood')}</p>
            )}
          </div>
        </div>

        <ul className="m-0 flex list-none flex-col p-0" aria-label={t('datePicker.title')}>
          {quickOptions.map(({ key, date }) => {
            const Icon = QUICK_ICONS[key];
            const active = draft.dueDate === date;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickDate(date, true)}
                  className={`flex h-8 w-full cursor-pointer items-center gap-3 rounded-xs border-none px-2 text-left text-[14px] transition-colors duration-(--motion-fast) hover:bg-dot/30 ${
                    active ? 'bg-dot/40 text-ink' : 'bg-transparent text-ink'
                  }`}
                >
                  <Icon {...ICON} className={key === 'today' ? 'text-accent' : 'text-ink-light'} />
                  <span className="flex-1">{t(QUICK_LABELS[key])}</span>
                  <span className="text-[12px] tabular-nums text-ink-light">{formatShortDay(date, locale)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Divider />

      <div className="flex flex-col gap-3 p-3">
        <MonthCalendar key={calendarKey} value={draft.dueDate} onSelect={(iso) => pickDate(iso, false)} weekStart={weekStart} />

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onOpenTime(false)} className={chip} title={timeLabel} aria-label={`${t('datePicker.addTime')}: ${timeLabel}`}>
            <Clock {...ICON} className="shrink-0 text-ink-light" />
            <span className="truncate">{timeLabel}</span>
          </button>
          <button type="button" onClick={onOpenRepeat} className={chip} title={repeatLabel} aria-label={`${t('datePicker.repeat')}: ${repeatLabel}`}>
            <Repeat {...ICON} className="shrink-0 text-ink-light" />
            <span className="truncate">{repeatLabel}</span>
          </button>
        </div>

        <button type="button" onClick={() => onOpenTime(true)} className={chip}>
          <Flag {...ICON} className="shrink-0 text-ink-light" />
          <span className="flex-1">{t('datePicker.deadline')}</span>
          <span className="flex items-center gap-1 text-[12px] text-ink-light">
            {deadlineLabel}
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="flex h-12 items-center justify-between border-t border-border px-3">
        <button
          type="button"
          onClick={onRemove}
          className="date-picker-remove h-8 cursor-pointer rounded-xs border-none bg-transparent px-1 text-[13px] text-ink-light transition-colors duration-(--motion-fast) hover:text-accent"
        >
          {t('datePicker.removeDate')}
        </button>
        <Button variant="primary" size="md" onClick={onSave} className="min-w-24">
          {t('common.save')}
        </Button>
      </div>
    </>
  );
}
