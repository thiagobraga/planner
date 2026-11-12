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
    <svg width={size} height={size} viewBox='0 0 15 15' fill='none' aria-hidden='true'>
      <path
        d='M3.5 0V5M11.5 0V5M1.5 2.5H13.5C14.0523 2.5 14.5 2.94772 14.5 3.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H1.5C0.947716 14.5 0.5 14.0523 0.5 13.5V3.5C0.5 2.94772 0.947715 2.5 1.5 2.5Z'
        stroke='currentColor'
      />
      <text
        data-testid='daily-day-number'
        x='7.5'
        y='11.8'
        textAnchor='middle'
        fontSize='8'
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
