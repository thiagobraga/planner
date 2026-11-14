import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateNavProps } from '../../types/toolbar';
import { fmtISO, formatRangeLabel, startOfWeek, weekdayInitials } from '../../utils/date';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nContext';

const WEEK_DAYS = 7;
const MAX_CALENDAR_WEEKS = 6;
const ICON_BUTTON = 'w-5 shrink-0 !px-0';

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Today, previous, the shown range with a day picker, and next. */
export function DateNav({ from, to, today, weekStart, onPrevious, onNext, onToday, onPick, compact = false, hideToday = false, defaultOpen = false }: DateNavProps) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parse(from);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
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

  const label = formatRangeLabel(from, to, locale, compact);
  const fullLabel = formatRangeLabel(from, to, locale);

  const gridStart = startOfWeek(viewMonth, weekStart);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const daysToMonthEnd = Math.round((monthEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const weekCount = Math.min(MAX_CALENDAR_WEEKS, Math.ceil(daysToMonthEnd / WEEK_DAYS));
  const cells = Array.from({ length: weekCount * WEEK_DAYS }, (_, i) => addDays(gridStart, i));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewMonth);
  const fullDateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const toggle = () => {
    if (!open) {
      const d = parse(from);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setOpen(!open);
  };

  const shiftViewMonth = (delta: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  return (
    <div ref={rootRef} className="date-nav relative flex h-6 items-center gap-1">
      {!hideToday && (
        <Button variant="secondary" size="xs" onClick={onToday}>
          {t('page.today')}
        </Button>
      )}
      <Button variant="secondary" size="xs" className={ICON_BUTTON} aria-label={t('view.previous')} onClick={onPrevious}>
        <ChevronLeft size={14} strokeWidth={1.8} />
      </Button>
      <Button
        size="xs"
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={fullLabel}
        onClick={toggle}
        className="date-nav-trigger !gap-1 font-semibold tracking-[0.04em] whitespace-nowrap"
      >
        {label}
        <ChevronDown className="ml-1" size={12} strokeWidth={1.8} />
      </Button>
      <Button variant="secondary" size="xs" className={ICON_BUTTON} aria-label={t('view.next')} onClick={onNext}>
        <ChevronRight size={14} strokeWidth={1.8} />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t('page.selectWeek')}
          className="date-nav-popover absolute left-0 top-full z-30 mt-1 w-72 border border-border bg-cream p-3"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="secondary" size="xs" className={ICON_BUTTON} aria-label={t('page.previousMonth')} onClick={() => shiftViewMonth(-1)}>
              <ChevronLeft size={14} strokeWidth={1.8} />
            </Button>
            <span className="text-sm font-medium capitalize text-ink">{monthLabel}</span>
            <Button variant="secondary" size="xs" className={ICON_BUTTON} aria-label={t('page.nextMonth')} onClick={() => shiftViewMonth(1)}>
              <ChevronRight size={14} strokeWidth={1.8} />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {weekdayInitials(weekStart, locale).map((initial, index) => (
              <span key={index} className="h-6 text-[11px] leading-6 tracking-[0.08em] text-ink">{initial}</span>
            ))}
            {cells.map((date) => {
              const iso = fmtISO(date);
              const inMonth = date.getMonth() === viewMonth.getMonth();
              const inRange = iso >= from && iso <= to;
              return (
                <button
                  type="button"
                  key={iso}
                  aria-label={inMonth ? undefined : fullDateFormat.format(date)}
                  aria-current={iso === today ? 'date' : undefined}
                  data-in-range={inRange ? 'true' : undefined}
                  onClick={() => {
                    onPick(iso);
                    setOpen(false);
                  }}
                  className={`h-6 text-[13px] leading-6 text-ink transition-colors duration-[var(--motion-fast)] hover:bg-dot/35 ${
                    inRange ? 'bg-dot/35' : ''
                  } ${iso === today ? 'font-semibold' : ''} ${inMonth ? '' : 'opacity-50'}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {hideToday && (
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" size="xs" onClick={() => { onToday(); setOpen(false); }}>
                {t('page.today')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
