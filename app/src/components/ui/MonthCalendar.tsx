import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtISO, startOfDay, weekdayColumnIndex, weekdayInitials, type WeekStart } from '../../utils/date';
import { parseISODate } from '../../utils/dateQuickOptions';
import { useI18n } from '../../i18n/I18nContext';

export interface MonthCalendarProps {
  /** Selected day as YYYY-MM-DD. */
  value: string | null;
  onSelect: (iso: string) => void;
  weekStart: WeekStart;
  /** Days after this YYYY-MM-DD are disabled. */
  maxDate?: string;
  /** `compact` is the 24px Styleguide grid; `comfortable` the date picker's. */
  density?: 'compact' | 'comfortable';
}

/** One month at a time: today ringed, the selected day filled with ink. */
export function MonthCalendar({ value, onSelect, weekStart, maxDate, density = 'comfortable' }: MonthCalendarProps) {
  const { locale, t } = useI18n();
  const todayISO = fmtISO(startOfDay(new Date()));
  const [viewDate, setViewDate] = useState(() => {
    const anchor = parseISODate(value ?? todayISO);
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayColumn = weekdayColumnIndex(new Date(year, month, 1).getDay(), weekStart);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate);
  const compact = density === 'compact';

  const cell = compact ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-[13px]';
  const navButton = compact
    ? 'h-6 w-6 rounded-[4px] border-none bg-transparent text-ink-light hover:bg-dot/30 hover:text-ink'
    : 'h-7 w-7 rounded-xs border border-border bg-(--planner-control-bg) text-ink-light hover:border-ink-lighter hover:text-ink';

  return (
    <div className={`ui-month-calendar ${compact ? 'w-fit' : 'w-full'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-2'}`} style={compact ? { width: 7 * 24 } : undefined}>
        <button
          type="button"
          aria-label={t('page.previousMonth')}
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className={`ui-month-calendar-prev flex cursor-pointer items-center justify-center transition-colors duration-(--motion-fast) ${navButton}`}
        >
          <ChevronLeft size={compact ? 12 : 14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <span
          aria-live="polite"
          className={`ui-month-calendar-label text-ink first-letter:uppercase ${compact ? 'text-[11px] font-medium tracking-[0.04em]' : 'text-[15px]'}`}
        >
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label={t('page.nextMonth')}
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className={`ui-month-calendar-next flex cursor-pointer items-center justify-center transition-colors duration-(--motion-fast) ${navButton}`}
        >
          <ChevronRight size={compact ? 12 : 14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: compact ? 'repeat(7, 24px)' : 'repeat(7, minmax(0, 1fr))' }}>
        {weekdayInitials(weekStart, locale).map((label, index) => (
          <span
            key={index}
            data-weekday-label
            aria-hidden="true"
            className={`flex h-6 items-center justify-center font-medium text-ink-light ${compact ? 'text-[10px] opacity-60' : 'text-[11px]'}`}
          >
            {label}
          </span>
        ))}

        {Array.from({ length: firstDayColumn }, (_, index) => (
          <span key={`blank-${index}`} data-calendar-blank aria-hidden="true" className={compact ? 'h-6 w-6' : 'h-8'} />
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(year, month, index + 1);
          const iso = fmtISO(date);
          const isSelected = iso === value;
          const isToday = iso === todayISO;
          return (
            <span key={iso} className="flex items-center justify-center">
              <button
                type="button"
                data-date={iso}
                aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                disabled={maxDate !== undefined && iso > maxDate}
                onClick={() => onSelect(iso)}
                className={`ui-month-calendar-day flex cursor-pointer items-center justify-center rounded-full tabular-nums transition-[background-color,color,transform] duration-(--motion-fast) active:scale-95 disabled:cursor-default disabled:opacity-30 ${cell} ${
                  isSelected
                    ? 'border border-ink bg-ink font-semibold text-cream'
                    : isToday
                      ? 'border border-ink bg-transparent font-semibold text-ink'
                      : `border border-transparent bg-transparent hover:bg-dot/40 hover:text-ink ${compact ? 'text-ink-light' : 'text-ink'}`
                }`}
              >
                {index + 1}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
