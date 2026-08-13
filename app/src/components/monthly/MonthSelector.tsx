import { useEffect, useState, useRef, useLayoutEffect, useImperativeHandle, type CSSProperties } from 'react';
import { StripNavigator } from '../ui/StripNavigator';
import { useI18n, type Locale } from '../../i18n/I18nContext';

const MONTH_WINDOW = 3;
const MONTH_STRIP_RANGE = MONTH_WINDOW * 2;
const MONTH_STRIP_GAP = 24;
const MONTH_CARD_SIZE = 60;
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

function buildMonthStrip(year: number, month: number, range: number): MonthTile[] {
  return Array.from({ length: range * 2 + 1 }, (_, index) => {
    const offset = index - range;
    const date = new Date(year, month + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth(), offset };
  });
}

function formatMonthLabel(year: number, month: number, locale: Locale): string {
  const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, month, 1));
  return (locale === 'pt-BR' ? label.replaceAll('.', '') : label).toLocaleUpperCase(locale);
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

export const MonthSelector = ({
  year: selectedYear,
  month: selectedMonth,
  onChange,
  className = '',
  ref,
}: MonthSelectorProps & { ref?: React.Ref<MonthSelectorHandle> }) => {
  const { locale, t } = useI18n();
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

  const bufferRange = renderRange * 2;
  const monthStrip = buildMonthStrip(selectedYear, selectedMonth, bufferRange);
  const today = new Date();
  const totalStripCards = monthStrip.length;
  const stripStep = MONTH_CARD_SIZE + MONTH_STRIP_GAP;
  // Snap the centering offset to the dot grid while approximately centering the selected month.
  const rawCenteringOffset = viewportWidth > 0
    ? viewportWidth / 2 - bufferRange * stripStep - MONTH_CARD_SIZE / 2
    : 0;
  const centeringOffset = Math.round(rawCenteringOffset / MONTH_STRIP_GAP) * MONTH_STRIP_GAP;
  const stripOffset = centeringOffset - (pendingMonth?.offset ?? 0) * stripStep;
  const stripTrackStyle = {
    width: `${MONTH_CARD_SIZE * totalStripCards + MONTH_STRIP_GAP * (totalStripCards - 1)}px`,
    gridTemplateColumns: `repeat(${totalStripCards}, ${MONTH_CARD_SIZE}px)`,
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
    <div className={`monthly-strip flex w-full min-w-0 items-center gap-(--dot-grid) ${className}`}>
      <StripNavigator
        direction="previous"
        aria-label={t('page.previousMonth')}
        onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, -1), -1)}
        className="month-strip-nav-prev"
      />

      <div ref={viewportRef} className="monthly-strip-viewport flex min-w-0 flex-1 items-center justify-start overflow-hidden">
        <div
          className="month-strip-track grid gap-[24px]"
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
            const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
            const yearLabel = String(year);
            return (
              <button
                type="button"
                key={`${year}-${month}`}
                onClick={() => selectMonth({ year, month }, offset)}
                aria-current={isSelected ? 'date' : undefined}
                className={`month-strip-card relative flex h-12 min-w-0 flex-col items-center justify-center border text-center cursor-pointer transition-colors duration-(--motion-fast) ${isCurrentMonth ? 'month-strip-card--current' : ''} ${
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
                  {formatMonthLabel(year, month, locale)}
                </span>
                <span className={`month-strip-card-year text-[11px] leading-5 tracking-[0.08em] text-ink-light sm:text-[11px] sm:tracking-widest ${isSelected ? 'font-medium' : 'font-normal'}`}>
                  {yearLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <StripNavigator
        direction="next"
        aria-label={t('page.nextMonth')}
        onClick={() => selectMonth(shiftMonth(selectedYear, selectedMonth, 1), 1)}
        className="month-strip-nav-next"
      />
    </div>
  );
};
