import { MonthSelector } from '../monthly/MonthSelector';
import { HabitMonthGrid } from './HabitMonthGrid';
import { dayState, type HabitNode, type HabitSections } from '../../utils/habitTree';

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
      <div className="habit-calendar-selector-sticky">
        <MonthSelector year={year} month={month} onChange={onMonthChange} />
      </div>

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
        <section key={section.group.id} className="habit-calendar-group mt-12">
          <h2 className="habit-calendar-group-name h-6 border-b border-border/60 text-[10px] font-semibold uppercase leading-6 tracking-[0.1em] text-ink-light">
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
            <p className="habit-calendar-group-empty mt-6 text-sm text-ink-light opacity-60">
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
  return (
    <div
      className="habit-calendar-grid mt-6 grid items-start gap-6"
      style={{ gridTemplateColumns: 'repeat(auto-fill, 192px)' }}
    >
      {habits.map((node) => (
        <div key={node.id} className="habit-calendar-item min-w-0">
          <HabitCalendarHeading node={node} />
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

function HabitCalendarHeading({ node }: { node: HabitNode }) {
  return (
    <div className="habit-calendar-item-heading flex h-6 items-center">
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: 'var(--color-ink-lighter)' }}
        />
      </span>
      <span className="habit-calendar-item-name truncate text-sm leading-6 text-ink">
        {node.name}
      </span>
    </div>
  );
}
