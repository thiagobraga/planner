import { useMemo } from 'react';
import { buildMonthDays, fmtISO, weekdayInitials, type WeekStart } from '../../utils/date';
import type { DayState } from '../../utils/habitTree';
import { HabitDot, dotAriaProps } from './HabitDot';
import { NO_DRAG_ATTR } from '../dnd/sensors';

const CELL = 24;
export interface HabitMonthGridProps {
  year: number;
  month: number;
  today: Date;
  weekStart: WeekStart;
  /** Resolves the rendered state of one day. Parents report their derived state. */
  stateFor: (iso: string) => DayState;
  onToggle?: (iso: string) => void;
  label?: string;
  readOnly?: boolean;
}

// One month of habit days as a weekday-aligned dot grid. Consecutive fully
// completed days are joined by a connector bar, the same chain language the
// timeline uses. Extracted from the styleguide specimen so both render from one
// implementation instead of drifting apart.
export function HabitMonthGrid({
  year,
  month,
  today,
  weekStart,
  stateFor,
  onToggle,
  label,
  readOnly = false,
}: HabitMonthGridProps) {
  const days = useMemo(
    () => buildMonthDays(year, month, today, weekStart),
    [year, month, today, weekStart],
  );
  const dayLabels = weekdayInitials(weekStart);
  const todayISO = fmtISO(today);
  const leadingBlanks = days[0]?.dow ?? 0;

  return (
    <div className="habit-month-grid min-w-0">
      <div
        className="habit-month-grid-labels grid"
        style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}
      >
        {dayLabels.map((letter, i) => (
          <span
            key={i}
            data-weekday-label
            className="habit-month-grid-label flex h-6 items-center justify-center text-[10px] text-ink-light opacity-70"
          >
            {letter}
          </span>
        ))}
      </div>

      <div
        className="habit-month-grid-cells grid"
        style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}
        role="group"
        aria-label={label}
      >
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" style={{ width: CELL, height: CELL }} />
        ))}

        {days.map((day, i) => {
          const state = stateFor(day.iso);
          // Any day with progress is part of the chain, so partly-done parent days
          // link to their neighbours rather than breaking the run.
          const linked = state !== 'empty';
          const prevLinked = i > 0 && linked && stateFor(days[i - 1].iso) !== 'empty';
          const nextLinked =
            i < days.length - 1 &&
            linked &&
            !days[i + 1].future &&
            stateFor(days[i + 1].iso) !== 'empty';

          if (day.future) {
            return (
              <span
                key={day.iso}
                aria-hidden="true"
                className="habit-month-grid-cell-future flex items-center justify-center text-[10px] text-ink-light opacity-35"
                style={{ width: CELL, height: CELL }}
              >
                {day.dayOfMonth}
              </span>
            );
          }

          const interactive = !readOnly && Boolean(onToggle);
          // A Calendar card is draggable as a whole, so its day cells opt out of
          // pointer drag - otherwise tracking a day would pick the habit up.

          return (
            <button
              key={day.iso}
              type="button"
              disabled={!interactive}
              onClick={interactive ? () => onToggle!(day.iso) : undefined}
              aria-label={`${label ? `${label} ` : ''}${day.iso}`}
              {...dotAriaProps(state)}
              {...{ [NO_DRAG_ATTR]: '' }}
              className={`habit-month-grid-cell group relative border-none bg-transparent p-0 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              } ${day.iso === todayISO ? 'habit-month-grid-cell-today' : ''}`}
              style={{ width: CELL, height: CELL }}
            >
              {prevLinked && (
                <span
                  aria-hidden="true"
                  className="habit-month-grid-connector-prev absolute top-1/2 left-0 h-px -translate-y-1/2"
                  style={{ width: CELL / 2, background: 'var(--color-ink-lighter)' }}
                />
              )}
              {nextLinked && (
                <span
                  aria-hidden="true"
                  className="habit-month-grid-connector-next absolute top-1/2 right-0 h-px -translate-y-1/2"
                  style={{ width: CELL / 2, background: 'var(--color-ink-lighter)' }}
                />
              )}
              <HabitDot state={state} interactive={interactive} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
