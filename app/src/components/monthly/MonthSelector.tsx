import { useEffect, useState, useRef, useLayoutEffect, forwardRef, useImperativeHandle, type CSSProperties } from 'react';
import { StripNavigator } from '../ui/StripNavigator';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_WINDOW = 3;
const MONTH_STRIP_RANGE = MONTH_WINDOW * 2;
const MONTH_STRIP_GAP = 24;
const MONTH_CARD_SIZE = 96;
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

export interface MonthSelectorHandle {
  animateTo: (year: number, month: number) => void;
}

export const MonthSelector = forwardRef<MonthSelectorHandle, MonthSelectorProps>(
  ({ year: selectedYear, month: selectedMonth, onChange, className = '' }, ref) => {
  const [isMobileStrip, setIsMobileStrip] = useState(() => window.innerWidth < 640);
  const [pendingMonth, setPendingMonth] = useState<MonthTile | null>(null);
  const [suppressStripTransition, setSuppressStripTransition] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const syncStripMode = () => {
      setIsMobileStrip(media.matches);
    };

    syncStripMode();
    media.addEventListener('change', syncStripMode);
    return () => media.removeEventListener('change', syncStripMode);
  }, []);

  // Measure viewport synchronously to avoid centering flash.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderRange = isMobileStrip ? 2 : MONTH_STRIP_RANGE;

  useImperativeHandle(ref, () => ({
    animateTo(year, month) {
      const offset = (year - selectedYear) * 12 + (month - selectedMonth);
      if (offset === 0) return;
      const cappedOffset = Math.sign(offset) * Math.min(Math.abs(offset), renderRange);
      setPendingMonth({ year, month, offset: cappedOffset });
    },
  }));

  const monthStrip = buildMonthStrip(selectedYear, selectedMonth);
  const totalStripCards = renderRange * 2 + 1;
  const stripStep = MONTH_CARD_SIZE + MONTH_STRIP_GAP;
  // Compute centering offset and snap it to the nearest dot-grid multiple (24px).
  // This keeps every card edge on the dot grid while approximately centering the selected month.
  const rawCenteringOffset = viewportWidth > 0
    ? viewportWidth / 2 - renderRange * stripStep - MONTH_CARD_SIZE / 2
    : 0;
  const centeringOffset = Math.round(rawCenteringOffset / MONTH_STRIP_GAP) * MONTH_STRIP_GAP;
  const stripOffset = centeringOffset - (pendingMonth?.offset ?? 0) * stripStep;
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
    <div className={`monthly-strip flex w-full min-w-0 items-start gap-(--dot-grid) ${className}`}>
      <StripNavigator
        direction="previous"
        aria-label="Previous month"
        onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, -1), -1)}
        className="month-strip-nav-prev"
      />

      <div ref={viewportRef} className="monthly-strip-viewport flex min-w-0 flex-1 items-center justify-start overflow-hidden">
        <div
          className="month-strip-track grid grid-cols-[repeat(5,96px)] gap-[24px] sm:grid-cols-[repeat(13,96px)]"
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
            const yearLabel = String(year);
            const mobileVisibility = Math.abs(offset) > 2 ? 'hidden sm:flex' : 'flex';

            return (
              <button
                type="button"
                key={`${year}-${month}`}
                onClick={() => selectMonth({ year, month }, offset)}
                aria-current={isSelected ? 'date' : undefined}
                className={`month-strip-card ${mobileVisibility} h-6 min-w-0 flex-row items-center justify-center gap-1 border text-center cursor-pointer transition-colors duration-(--motion-fast) ${
                  isSelected
                    ? 'border-ink-light text-ink'
                    : 'border-border/80 text-ink-light hover:border-dot hover:text-ink'
                }`}
                style={isSelected
                  ? { backgroundColor: 'var(--planner-monthly-strip-selected)' }
                  : { backgroundColor: 'var(--planner-monthly-strip-idle)' }
                }
              >
                <span className={`month-strip-card-month text-[11px] leading-5 tracking-[0.08em] sm:text-[11px] sm:tracking-widest ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                  {MONTHS[month]}
                </span>
                <span className={`month-strip-card-year text-[11px] leading-5 tracking-[0.08em] sm:text-[11px] sm:tracking-widest ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                  {yearLabel}
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
});
