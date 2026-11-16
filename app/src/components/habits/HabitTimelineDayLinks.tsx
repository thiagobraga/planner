import { CELL_W } from '../../utils/habitTimeline';

const CONNECTOR_STYLE = { width: CELL_W / 2, background: 'var(--color-ink-lighter)' };

/** The half-cell lines that chain a day's mark to its neighbours. */
export function HabitTimelineDayLinks({ prevLinked, nextLinked }: { prevLinked: boolean; nextLinked: boolean }) {
  return (
    <>
      {prevLinked && (
        <span
          aria-hidden="true"
          className="habit-timeline-day-connector-prev absolute top-1/2 left-0 h-px -translate-y-1/2"
          style={CONNECTOR_STYLE}
        />
      )}
      {nextLinked && (
        <span
          aria-hidden="true"
          className="habit-timeline-day-connector-next absolute top-1/2 right-0 h-px -translate-y-1/2"
          style={CONNECTOR_STYLE}
        />
      )}
    </>
  );
}
