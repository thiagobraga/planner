import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WeekSelectorProps } from '../../types/dailyBoard';
import { fmtISO, formatWeekRangeNumeric, shiftWeek, startOfWeek, weekdayInitials } from '../../utils/date';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nContext';

const WEEK_DAYS = 7;
const MAX_CALENDAR_WEEKS = 6;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function WeekSelector({ weekAnchor, today, weekStart, onWeekChange }: WeekSelectorProps) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const weekStartDate = startOfWeek(weekAnchor, weekStart);
  const weekEndDate = addDays(weekStartDate, WEEK_DAYS - 1);
  const rangeLabel = formatWeekRangeNumeric(weekStartDate, weekEndDate, locale);
  const weekStartKey = fmtISO(weekStartDate);
  const weekEndKey = fmtISO(weekEndDate);
  const todayKey = fmtISO(today);

  const gridStart = startOfWeek(viewMonth, weekStart);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const daysToMonthEnd = Math.round((monthEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const weekCount = Math.min(MAX_CALENDAR_WEEKS, Math.ceil(daysToMonthEnd / WEEK_DAYS));
  const cells = Array.from({ length: weekCount * WEEK_DAYS }, (_, i) => addDays(gridStart, i));

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewMonth);
  const fullDateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const toggle = () => {
    if (!open) setViewMonth(new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), 1));
    setOpen(!open);
  };

  const pick = (date: Date) => {
    onWeekChange(date);
    setOpen(false);
  };

  const shiftViewMonth = (delta: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  return (
    <div ref={rootRef} className="week-selector relative flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="w-6 shrink-0 !px-0"
        aria-label={t('page.previousWeek')}
        onClick={() => onWeekChange(shiftWeek(weekAnchor, -1))}
      >
        <ChevronLeft size={16} strokeWidth={1.8} />
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="week-selector-trigger"
      >
        {rangeLabel}
        <ChevronDown size={14} strokeWidth={1.8} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="w-6 shrink-0 !px-0"
        aria-label={t('page.nextWeek')}
        onClick={() => onWeekChange(shiftWeek(weekAnchor, 1))}
      >
        <ChevronRight size={16} strokeWidth={1.8} />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t('page.selectWeek')}
          className="week-selector-popover absolute left-0 top-full z-30 mt-1 w-72 border border-border bg-cream p-3"
          style={{ boxShadow: '0 8px 32px rgba(44,44,44,0.15)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-6 shrink-0 !px-0"
              aria-label={t('page.previousMonth')}
              onClick={() => shiftViewMonth(-1)}
            >
              <ChevronLeft size={16} strokeWidth={1.8} />
            </Button>
            <span className="text-sm font-medium capitalize text-ink">{monthLabel}</span>
            <Button
              variant="secondary"
              size="sm"
              className="w-6 shrink-0 !px-0"
              aria-label={t('page.nextMonth')}
              onClick={() => shiftViewMonth(1)}
            >
              <ChevronRight size={16} strokeWidth={1.8} />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {weekdayInitials(weekStart, locale).map((initial, index) => (
              <span key={index} className="h-6 text-[11px] leading-6 tracking-[0.08em] text-ink-light">{initial}</span>
            ))}
            {cells.map((date) => {
              const iso = fmtISO(date);
              const inMonth = date.getMonth() === viewMonth.getMonth();
              const inWeek = iso >= weekStartKey && iso <= weekEndKey;
              return (
                <button
                  type="button"
                  key={iso}
                  aria-label={inMonth ? undefined : fullDateFormat.format(date)}
                  aria-current={iso === todayKey ? 'date' : undefined}
                  data-in-week={inWeek ? 'true' : undefined}
                  onClick={() => pick(date)}
                  className={`h-6 text-[13px] leading-6 transition-colors duration-[var(--motion-fast)] hover:bg-dot/35 ${
                    inWeek ? 'bg-dot/35' : ''
                  } ${iso === todayKey ? 'font-semibold text-accent' : inMonth ? 'text-ink' : 'text-ink-light'}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
