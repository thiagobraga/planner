import { useEffect, useState, type CSSProperties } from 'react';
import { StripNavigator } from '../ui/StripNavigator';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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

export interface MonthSelectorProps {
  year: number;
  month: number; // 0-based
  onChange: (year: number, month: number) => void;
  className?: string;
}

export function MonthSelector({ year: selectedYear, month: selectedMonth, onChange, className = '' }: MonthSelectorProps) {
  const [isMobileStrip, setIsMobileStrip] = useState(() => window.innerWidth < 640);
  const [pendingMonth, setPendingMonth] = useState<MonthTile | null>(null);
  const [suppressStripTransition, setSuppressStripTransition] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const syncStripMode = () => {
      setIsMobileStrip(media.matches);
    };

    syncStripMode();
    media.addEventListener('change', syncStripMode);
    return () => media.removeEventListener('change', syncStripMode);
  }, []);

  const monthStrip = buildMonthStrip(selectedYear, selectedMonth);
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
    onChange(pendingMonth.year, pendingMonth.month);
    setPendingMonth(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSuppressStripTransition(false));
    });
  };

  return (
    <div className={`monthly-strip flex w-full min-w-0 items-center gap-3 sm:gap-4 ${className}`}>
      <StripNavigator
        direction="previous"
        aria-label="Previous month"
        onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, -1), -1)}
        className="month-strip-nav-prev"
      />

      <div className="monthly-strip-viewport min-w-0 flex-1 overflow-hidden">
        <div
          className="month-strip-track grid grid-cols-[repeat(5,72px)] gap-2 sm:grid-cols-[repeat(13,72px)]"
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
                className={`month-strip-card ${mobileVisibility} h-[72px] w-[72px] min-w-0 flex-col items-center justify-center rounded-[7px] border px-2 text-center transition-colors duration-[var(--motion-fast)] ${
                  isSelected
                    ? 'border-ink text-ink'
                    : 'border-border/80 text-ink-light hover:border-dot hover:text-ink'
                }`}
                style={isSelected
                  ? { backgroundColor: 'var(--planner-monthly-strip-selected)' }
                  : { backgroundColor: 'var(--planner-monthly-strip-idle)' }
                }
              >
                <span className="month-strip-card-year text-[10px] leading-4 tracking-[0.08em] sm:text-[10px]">
                  {yearLabel}
                </span>
                <span className={`month-strip-card-month mt-0.5 text-[13px] leading-5 tracking-[0.08em] sm:text-[12px] sm:tracking-[0.1em] ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                  {MONTHS[month]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <StripNavigator
        direction="next"
        aria-label="Next month"
        onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, 1), 1)}
        className="month-strip-nav-next"
      />
    </div>
  );
}
