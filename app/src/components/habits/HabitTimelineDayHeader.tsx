import type { HabitTimelineDayHeaderProps } from '../../types/habitTimeline';
import { CELL_W, WEEK_W } from '../../utils/habitTimeline';

/** Weekday letters and day numbers, sticky above the day grid. */
export function HabitTimelineDayHeader({ days, dayColClass, labelColWidth, todayISO }: HabitTimelineDayHeaderProps) {
  return (
    <div className="habit-timeline-selectors-sticky">
      <div className="habit-timeline-day-selector flex min-w-0 items-start gap-0">
        <div className="h-12 shrink-0 min-w-0" style={{ width: labelColWidth }} aria-hidden="true" />
        <div className="habit-timeline-header flex h-12 shrink-0" style={{ width: WEEK_W }}>
          {days.map((d) => (
            <div
              key={d.iso}
              className={`habit-timeline-header-day flex h-12 shrink-0 flex-col items-center justify-center ${dayColClass(d)}`}
              style={{ width: CELL_W }}
            >
              <span className="habit-timeline-header-day-letter block h-6 w-full text-center text-[10px] leading-[24px] text-ink-light opacity-70">
                {d.letter}
              </span>
              <span
                className={`habit-timeline-header-day-number block h-6 w-full text-center text-[10px] leading-[24px] ${
                  d.iso === todayISO ? 'text-ink font-semibold' : 'text-ink-light'
                }`}
              >
                {d.dayOfMonth}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
