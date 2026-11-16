import type { HabitTimelineBlockPreviewProps } from '../../types/habitTimeline';
import { CELL_W, INDENT, WEEK_W, dayLink } from '../../utils/habitTimeline';
import { HabitDot } from './HabitDot';
import { HabitTimelineDayLinks } from './HabitTimelineDayLinks';

/**
 * The dragged habit rows, drawn as they appear in the timeline, for the overlay.
 *
 * Deliberately not the row components: those register sortable hooks and own
 * edit state, none of which belongs to a copy floating under the pointer. The
 * day cells are spans rather than buttons here for the same reason.
 *
 * The timeline splits one row across two columns - the label column and the
 * week - so the preview rebuilds that geometry with the same widths.
 */
export function HabitTimelineBlockPreview({ rows, days, dayColClass, labelColWidth }: HabitTimelineBlockPreviewProps) {
  const base = rows[0]?.depth ?? 0;

  return (
    <div className="habit-timeline-block-preview" aria-hidden>
      {rows.map(({ node, depth }) => (
        <div key={node.id} className="flex h-6 items-start">
          <div
            className="habit-timeline-row-label flex h-6 min-w-0 shrink-0 items-center pr-2"
            // Depths are relative to the block, so a sub-habit dragged out of
            // level 1 draws flush rather than indented into empty space.
            style={{ width: labelColWidth, paddingLeft: Math.max(0, depth - base) * INDENT }}
          >
            <span className="habit-timeline-row-name min-w-0 flex-1 truncate text-sm leading-6 text-ink">
              {node.name}
            </span>
          </div>

          <div className="flex h-6 shrink-0" style={{ width: WEEK_W }}>
            {days.map((d, i) => {
              if (d.future) {
                return (
                  <span
                    key={d.iso}
                    className={`habit-timeline-day-placeholder h-6 shrink-0 ${dayColClass(d)}`}
                    style={{ width: CELL_W }}
                  />
                );
              }

              const { state, prevLinked, nextLinked } = dayLink(node, days, i);
              return (
                <span
                  key={d.iso}
                  className={`habit-timeline-day-cell relative h-6 shrink-0 ${dayColClass(d)}`}
                  style={{ width: CELL_W }}
                >
                  <HabitTimelineDayLinks prevLinked={prevLinked} nextLinked={nextLinked} />
                  <HabitDot state={state} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
