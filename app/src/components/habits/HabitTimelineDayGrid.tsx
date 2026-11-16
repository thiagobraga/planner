import type { HabitTimelineDayGridProps } from '../../types/habitTimeline';
import { CELL_W, WEEK_W, dayLink } from '../../utils/habitTimeline';
import { HabitDot, dotAriaProps } from './HabitDot';
import { HabitTimelineDayLinks } from './HabitTimelineDayLinks';

/** The week column: one band per timeline row, in the same order as the labels. */
export function HabitTimelineDayGrid({ rows, days, dayColClass, onToggleDay }: HabitTimelineDayGridProps) {
  return (
    <div className="habit-timeline-days shrink-0">
      <div className="habit-timeline-table-inner" style={{ width: WEEK_W }}>
        {rows.map((row) => {
          // Non-habit rows still occupy a band so both columns stay in step,
          // and keep the weekend/today column shading unbroken top to bottom.
          if (row.kind !== 'habit') {
            return (
              <div key={row.key} className="flex h-6" aria-hidden="true">
                {days.map((d) => (
                  <span key={d.iso} className={`h-6 shrink-0 ${dayColClass(d)}`} style={{ width: CELL_W }} />
                ))}
              </div>
            );
          }

          const { node } = row;
          return (
            <div key={row.key} className="habit-timeline-row flex h-6">
              {days.map((d, i) => {
                if (d.future) {
                  return (
                    <span
                      key={d.iso}
                      aria-hidden="true"
                      className={`habit-timeline-day-placeholder h-6 shrink-0 ${dayColClass(d)}`}
                      style={{ width: CELL_W }}
                    />
                  );
                }

                const { state, prevLinked, nextLinked } = dayLink(node, days, i);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => onToggleDay(node, d.iso)}
                    aria-label={`${node.name} ${d.iso}`}
                    {...dotAriaProps(state)}
                    className={`habit-timeline-day-cell group relative h-6 shrink-0 cursor-pointer border-none bg-transparent p-0 ${dayColClass(d)}`}
                    style={{ width: CELL_W }}
                  >
                    <HabitTimelineDayLinks prevLinked={prevLinked} nextLinked={nextLinked} />
                    <HabitDot state={state} interactive />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
