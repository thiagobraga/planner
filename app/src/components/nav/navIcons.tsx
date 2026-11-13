import { useCallback, useState } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { useMidnightTimer } from '../../hooks/useMidnightTimer';
import { fmtISOInTimeZone } from '../../utils/date';
import type { NavIconProps, PlannerIconProps } from '../../types/navigation';

export const CalendarDayIcon = ({ size = 15 }: NavIconProps) => {
  const { data: prefs } = usePreferences();
  const timeZone = prefs?.timeZone;
  const [now, setNow] = useState(() => new Date());
  useMidnightTimer(
    useCallback(() => setNow(new Date()), []),
    timeZone,
  );
  const day = Number(fmtISOInTimeZone(now, timeZone).slice(8));

  return (
    <svg width={size} height={size - 1} viewBox='0 0 15 15' fill='none' aria-hidden='true'>
      <rect x='0.5' y='0.5' width='14' height='14' rx='1.5' stroke='currentColor' />
      <rect x='1' y='1' width='13' height='3' fill='currentColor' />
      <text
        data-testid='daily-day-number'
        x='7.5'
        y='12.6'
        textAnchor='middle'
        fontSize='8'
        fontWeight='700'
        fill='currentColor'
      >
        {day}
      </text>
    </svg>
  );
};

export const MonthlyIcon = ({ size = 15 }: NavIconProps) => (
  <svg width={size} height={size} viewBox='0 0 15 15' fill='none' aria-hidden='true'>
    <circle cx='3' cy='4' r='1' fill='currentColor' />
    <circle cx='3' cy='7.5' r='1' fill='currentColor' />
    <circle cx='3' cy='11' r='1' fill='currentColor' />
    <path d='M6 4H12' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
    <path d='M6 7.5H12' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
    <path d='M6 11H12' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
  </svg>
);

export const StyleguideIcon = ({ size = 15 }: NavIconProps) => (
  <svg width={size} height={size} viewBox='0 0 15 15' fill='none' aria-hidden='true'>
    <rect x='2' y='2' width='11' height='11' rx='1.5' stroke='currentColor' strokeWidth='1.2' />
    <path d='M4 5.5H11' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' />
    <path d='M4 8H11' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' />
    <path d='M4 10.5H8.5' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' />
  </svg>
);

/** Closed black book on light themes, open book on dark; CSS swaps them via `<html data-theme>`. */
export const PlannerIcon = ({
  width,
  height,
  className = '',
}: PlannerIconProps) => (
  <>
    <img
      src={`/images/logo/logo-closed-${width}x${height}.png`}
      srcSet={`/images/logo/logo-closed-${width * 2}x${height * 2}.png 2x`}
      width={width}
      height={height}
      className={`planner-icon-light block shrink-0 ${className}`}
      alt=''
    />
    <img
      src={`/images/logo/logo-${width}x${height}.png`}
      srcSet={`/images/logo/logo-${width * 2}x${height * 2}.png 2x`}
      width={width}
      height={height}
      className={`planner-icon-dark hidden shrink-0 ${className}`}
      alt=''
    />
  </>
);
