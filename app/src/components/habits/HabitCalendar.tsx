import { MonthSelector } from '../monthly/MonthSelector';
import { HabitMonthGrid } from './HabitMonthGrid';
import { dayState, flattenHabits, type HabitNode, type HabitSections } from '../../utils/habitTree';

export interface HabitCalendarProps {
  sections: HabitSections;
  today: Date;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onToggleDay: (node: HabitNode, iso: string) => void;
}

// Month-at-a-glance view: one dot grid per habit, as many across as the viewport
// fits, collapsing to a single column when narrow. Ungrouped habits first, then
// one section per group.
export function HabitCalendar({
  sections,
  today,
  year,
  month,
  onMonthChange,
  onToggleDay,
}: HabitCalendarProps) {
  const hasAnything =
    sections.ungrouped.length > 0 || sections.groups.some((s) => s.habits.length > 0);

  return (
    <div className="habit-calendar">
      <MonthSelector year={year} month={month} onChange={onMonthChange} className="mt-6" />

      {!hasAnything && (
        <p className="habit-calendar-empty mt-8 text-sm text-ink-light opacity-60">
          No habits yet. Switch to the timeline to add one.
        </p>
      )}

      {sections.ungrouped.length > 0 && (
        <HabitCalendarGrid
          habits={sections.ungrouped}
          today={today}
          year={year}
          month={month}
          onToggleDay={onToggleDay}
        />
      )}

      {sections.groups.map((section) => (
        <section key={section.group.id} className="habit-calendar-group mt-10">
          <h2 className="habit-calendar-group-name text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light">
            {section.group.name}
          </h2>
          {section.habits.length > 0 ? (
            <HabitCalendarGrid
              habits={section.habits}
              today={today}
              year={year}
              month={month}
              onToggleDay={onToggleDay}
            />
          ) : (
            <p className="habit-calendar-group-empty mt-2 text-sm text-ink-light opacity-60">
              No habits in this group.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

interface HabitCalendarGridProps {
  habits: HabitNode[];
  today: Date;
  year: number;
  month: number;
  onToggleDay: (node: HabitNode, iso: string) => void;
}

function HabitCalendarGrid({ habits, today, year, month, onToggleDay }: HabitCalendarGridProps) {
  // Sub-habits get their own cell rather than nesting inside the parent's. Nesting
  // made one column as tall as its sub-habit stack and stretched the whole row,
  // leaving the other columns short and a large gap beneath them.
  const cells = flattenHabits(habits);

  return (
    <div
      className="habit-calendar-grid mt-4 grid items-start gap-x-8 gap-y-8"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
    >
      {cells.map(({ node, depth }) => (
        <div key={node.id} className="habit-calendar-item min-w-0">
          <HabitCalendarHeading node={node} muted={depth > 0} />
          <HabitMonthGrid
            year={year}
            month={month}
            today={today}
            label={node.name}
            stateFor={(iso) => dayState(node, iso)}
            onToggle={(iso) => onToggleDay(node, iso)}
          />
        </div>
      ))}
    </div>
  );
}

function HabitCalendarHeading({ node, muted = false }: { node: HabitNode; muted?: boolean }) {
  return (
    <div className="habit-calendar-item-heading mb-1 flex h-6 items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: 'var(--color-ink-lighter)' }}
      />
      <span
        className={`habit-calendar-item-name truncate text-sm leading-6 ${
          muted ? 'text-ink-light' : 'text-ink'
        }`}
      >
        {node.name}
      </span>
    </div>
  );
}
