import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchMonthNotes, type ApiTask } from '../api/client';
import { useSync } from '../hooks/useSync';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_WINDOW = 3;
const MONTH_STRIP_RANGE = MONTH_WINDOW * 2;
const MONTH_STRIP_GAP = 8;
const MONTH_CARD_SIZE = 72;
const MONTH_STRIP_DURATION_MS = 220;

type MonthTile = {
  year: number;
  month: number;
  offset: number;
};

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftMonth(year: number, month: number, delta: number): Omit<MonthTile, 'offset'> {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function buildMonthStrip(year: number, month: number): MonthTile[] {
  return Array.from({ length: MONTH_STRIP_RANGE * 2 + 1 }, (_, index) => {
    const offset = index - MONTH_STRIP_RANGE;
    const date = new Date(year, month + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth(), offset };
  });
}

function getInitialMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthlyNoteText(note: ApiTask): string {
  if (note.type === 'note') {
    return note.title;
  }

  const description = note.description?.trim();
  return description || note.title;
}

export function MonthlyRows() {
  const initialMonth = getInitialMonth();
  const [isMobileStrip, setIsMobileStrip] = useState(() => window.innerWidth < 640);
  const [selectedYear, setSelectedYear] = useState(initialMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth.month);
  const [pendingMonth, setPendingMonth] = useState<MonthTile | null>(null);
  const [suppressStripTransition, setSuppressStripTransition] = useState(false);
  const [notesByDate, setNotesByDate] = useState<Record<string, string[]>>({});

  const loadMonthNotes = useCallback(() => {
    let active = true;

    fetchMonthNotes(selectedYear, selectedMonth + 1)
      .then((res) => {
        if (!active) {
          return;
        }

        const byDate: Record<string, string[]> = {};
        for (const [date, notes] of Object.entries(res.notesByDate)) {
          byDate[date] = notes.map(monthlyNoteText).filter((text) => text.length > 0);
        }
        setNotesByDate(byDate);
      })
      .catch(() => {
        if (active) {
          setNotesByDate({});
        }
      });

    return () => {
      active = false;
    };
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const syncStripMode = () => {
      setIsMobileStrip(media.matches);
    };

    syncStripMode();
    media.addEventListener('change', syncStripMode);
    return () => media.removeEventListener('change', syncStripMode);
  }, []);

  useEffect(() => {
    return loadMonthNotes();
  }, [loadMonthNotes]);

  useSync(useCallback((event) => {
    if (event.entityType === 'task') {
      loadMonthNotes();
    }
  }, [loadMonthNotes]));

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthStrip = buildMonthStrip(selectedYear, selectedMonth);
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const visibleSide = isMobileStrip ? 1 : MONTH_WINDOW;
  const renderRange = isMobileStrip ? 2 : MONTH_STRIP_RANGE;
  const totalStripCards = renderRange * 2 + 1;
  const stripStep = MONTH_CARD_SIZE + MONTH_STRIP_GAP;
  const stripOffset = -((renderRange - visibleSide) + (pendingMonth?.offset ?? 0)) * stripStep;
  const stripTrackStyle = {
    width: `${MONTH_CARD_SIZE * totalStripCards + MONTH_STRIP_GAP * (totalStripCards - 1)}px`,
    transform: `translateX(${stripOffset}px)`,
    transition: suppressStripTransition || !pendingMonth ? 'none' : `transform ${MONTH_STRIP_DURATION_MS}ms ease-in-out`,
  } satisfies CSSProperties;
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayOfWeekIndex = new Date(selectedYear, selectedMonth, day).getDay();

    return {
      day,
      weekday: WEEKDAYS[dayOfWeekIndex],
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      isToday: dateKey(selectedYear, selectedMonth, day) === todayKey,
    };
  });

  const selectMonth = (tile: Omit<MonthTile, 'offset'>, offset: number) => {
    if (offset === 0 || pendingMonth) {
      return;
    }

    setPendingMonth({ ...tile, offset });
  };

  const commitPendingMonth = () => {
    if (!pendingMonth) {
      return;
    }

    setSuppressStripTransition(true);
    setSelectedYear(pendingMonth.year);
    setSelectedMonth(pendingMonth.month);
    setPendingMonth(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSuppressStripTransition(false));
    });
  };

  return (
    <div className="text-ink">
      <div className="monthly-strip mb-6 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, -1), -1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-dot/20 text-ink-light transition-colors duration-[var(--motion-fast)] hover:bg-dot/35 hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.8} />
        </button>

        <div className="monthly-strip-viewport w-[232px] shrink-0 overflow-hidden sm:w-[552px]">
          <div
            className="grid grid-cols-[repeat(5,72px)] gap-2 sm:grid-cols-[repeat(13,72px)]"
            style={stripTrackStyle}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'transform') {
                commitPendingMonth();
              }
            }}
          >
            {monthStrip.map(({ year, month, offset }) => {
              const activeYear = pendingMonth?.year ?? selectedYear;
              const activeMonth = pendingMonth?.month ?? selectedMonth;
              const isSelected = year === activeYear && month === activeMonth;
              const yearLabel = String(year).slice(-2);
              const mobileVisibility = Math.abs(offset) > 2 ? 'hidden sm:flex' : 'flex';

              return (
                <button
                  type="button"
                  key={`${year}-${month}`}
                  onClick={() => selectMonth({ year, month }, offset)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`${mobileVisibility} h-[72px] w-[72px] min-w-0 flex-col items-center justify-center rounded-[7px] border px-2 text-center transition-colors duration-[var(--motion-fast)] ${
                    isSelected
                      ? 'border-ink text-ink'
                      : 'border-border/80 text-ink-light hover:border-dot hover:text-ink'
                  }`}
                  style={isSelected
                    ? { backgroundColor: 'var(--planner-monthly-strip-selected)' }
                    : { backgroundColor: 'var(--planner-monthly-strip-idle)' }
                  }
                >
                  <span className="text-[10px] leading-4 tracking-[0.08em] sm:text-[10px]">
                    {yearLabel}
                  </span>
                  <span className={`mt-0.5 text-[13px] leading-5 tracking-[0.08em] sm:text-[12px] sm:tracking-[0.1em] ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {MONTHS[month]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, 1), 1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-dot/20 text-ink-light transition-colors duration-[var(--motion-fast)] hover:bg-dot/35 hover:text-ink"
        >
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className="monthly-ledger overflow-hidden rounded-[3px] border border-border/80"
        style={{ backgroundColor: 'var(--planner-monthly-ledger-bg)' }}
      >
        {days.map((day) => {
          const key = dateKey(selectedYear, selectedMonth, day.day);
          const notes = notesByDate[key] ?? [];
          const weekendStyle = day.isWeekend ? { backgroundColor: 'var(--planner-monthly-weekend)' } : undefined;

          return (
            <div
              key={day.day}
              style={weekendStyle}
              className="grid h-6 grid-cols-[30px_20px_minmax(0,1fr)] items-center border-b border-border/60 px-4 last:border-b-0"
            >
              <span className={`text-[11px] leading-6 tracking-[0.08em] text-ink-light tabular-nums ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {String(day.day).padStart(2, '0')}
              </span>
              <span className={`text-center text-[11px] leading-6 tracking-[0.08em] text-ink-light uppercase ${day.isToday ? 'monthly-current-day-label font-[800]' : 'font-medium'}`}>
                {day.weekday}
              </span>
              <div className="min-w-0 border-l border-dot/30 pl-4">
                {notes.length > 0 ? (
                  <span className="block min-w-0 truncate text-[13px] leading-6 text-ink normal-case tracking-normal">
                    {notes.join(' · ')}
                  </span>
                ) : (
                  <span className="block h-6" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
