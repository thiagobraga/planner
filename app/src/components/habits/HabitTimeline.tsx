import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { MonthStrip } from '../MonthStrip';
import { fmtISO } from './HabitGrid';

const CELL_W = 28;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface TimelineHabit {
  id: string;
  name: string;
  note?: string;
  color: string;
  completions: Set<string>;
}

export interface HabitTimelineProps {
  habits: TimelineHabit[];
  today: Date;
  // Increment to jump the timeline back to the current month (e.g. from a header button).
  todaySignal?: number;
  onToggle: (habitId: string, isoDate: string, isCompleted: boolean) => void;
  onEdit: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}

interface DayCell {
  iso: string;
  letter: string;
  dayOfMonth: number;
  future: boolean;
}

// Horizontal habit tracker for one month: one row per habit, one column per day.
// Done days render as colored dots; consecutive done days are joined by a
// connector line. Month is picked via the shared MonthStrip navigator.
export function HabitTimeline({ habits, today, todaySignal, onToggle, onEdit, onDelete }: HabitTimelineProps) {
  const [menu, setMenu] = useState<{ habitId: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const days = useMemo<DayCell[]>(() => {
    const daysInMonth = new Date(selected.year, selected.month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(selected.year, selected.month, i + 1);
      return {
        iso: fmtISO(date),
        letter: DAY_LETTERS[date.getDay()],
        dayOfMonth: i + 1,
        future: date.getTime() > today.getTime(),
      };
    });
  }, [selected, today]);

  const todayISO = fmtISO(today);

  useEffect(() => {
    if (todaySignal) {
      setSelected({ year: today.getFullYear(), month: today.getMonth() });
    }
  }, [todaySignal, today]);

  return (
    <div className="habit-timeline">
      {/* Month navigator (shared with Monthly page) */}
      <MonthStrip
        year={selected.year}
        month={selected.month}
        onChange={(year, month) => setSelected({ year, month })}
        className="mt-6"
      />

      {/* Timeline table */}
      <div className="habit-timeline-table mt-6 overflow-x-auto">
        <div className="habit-timeline-table-inner inline-block min-w-full">
          {/* Header row */}
          <div className="habit-timeline-header flex">
            <div className="habit-timeline-header-label sticky left-0 z-10 shrink-0 w-32 flex items-end pb-2 pr-3">
              <span className="habit-timeline-header-text text-[10px] tracking-[0.08em] uppercase text-ink-light font-medium">
                Habit
              </span>
            </div>
            {days.map((d) => (
              <div
                key={d.iso}
                className={`habit-timeline-header-day shrink-0 flex flex-col items-center justify-end gap-1 pb-2 pt-3 ${d.future ? 'opacity-40' : ''}`}
                style={{ width: CELL_W }}
              >
                <span className="habit-timeline-header-day-letter text-[10px] leading-none text-ink-light opacity-70">{d.letter}</span>
                <span
                  className={`habit-timeline-header-day-number text-[10px] leading-none ${
                    d.iso === todayISO ? 'text-ink font-semibold' : 'text-ink-light'
                  }`}
                >
                  {d.dayOfMonth}
                </span>
              </div>
            ))}
          </div>

          {/* Habit rows */}
          {habits.map((habit) => (
            <div key={habit.id} className="habit-timeline-row flex group">
              <div className="habit-timeline-row-label sticky left-0 z-10 shrink-0 w-32 flex items-center gap-2 pr-2 h-14">
                <span
                  className="habit-timeline-row-color-dot w-2 h-2 rounded-full shrink-0"
                  style={{ background: habit.color }}
                  aria-hidden="true"
                />
                <span className="habit-timeline-row-name flex-1 min-w-0 truncate text-sm text-ink" title={habit.note}>
                  {habit.name}
                </span>
                <button
                  type="button"
                  aria-label={`Options for ${habit.name}`}
                  className="habit-timeline-row-options shrink-0 p-1 rounded-[4px] text-ink-light opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink hover:bg-dot/30 cursor-pointer transition-opacity duration-75"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenu({ habitId: habit.id, x: rect.left, y: rect.bottom + 4 });
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {days.map((d, i) => {
                if (d.future) {
                  return (
                    <span
                      key={d.iso}
                      aria-hidden="true"
                      className="habit-timeline-day-placeholder shrink-0 h-14"
                      style={{ width: CELL_W }}
                    />
                  );
                }
                const done = habit.completions.has(d.iso);
                const prevDone = i > 0 && done && habit.completions.has(days[i - 1].iso);
                const nextDone =
                  i < days.length - 1 && done && !days[i + 1].future && habit.completions.has(days[i + 1].iso);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => onToggle(habit.id, d.iso, !done)}
                    aria-label={`${habit.name} ${d.iso}${done ? ' completed' : ' not completed'}`}
                    aria-pressed={done}
                    className="habit-timeline-day-cell relative shrink-0 h-14 p-0 bg-transparent border-none cursor-pointer"
                    style={{ width: CELL_W }}
                  >
                    {/* connector halves */}
                    {prevDone && (
                      <span
                        aria-hidden="true"
                        className="habit-timeline-day-connector-prev absolute top-1/2 -translate-y-1/2 left-0 h-[2px]"
                        style={{ width: CELL_W / 2, background: habit.color }}
                      />
                    )}
                    {nextDone && (
                      <span
                        aria-hidden="true"
                        className="habit-timeline-day-connector-next absolute top-1/2 -translate-y-1/2 right-0 h-[2px]"
                        style={{ width: CELL_W / 2, background: habit.color }}
                      />
                    )}
                    {/* dot */}
                    <span
                      aria-hidden="true"
                      className="habit-timeline-day-dot absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={
                        done
                          ? { width: 8, height: 8, background: habit.color }
                          : { width: 3, height: 3, background: 'var(--color-dot)' }
                      }
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="habit-timeline-legend flex items-center justify-center gap-6 mt-4 text-xs text-ink-light">
        <span className="habit-timeline-legend-item inline-flex items-center gap-2">
          <span className="habit-timeline-legend-dot-not-done w-[5px] h-[5px] rounded-full bg-dot inline-block" /> Not done
        </span>
        <span className="habit-timeline-legend-item inline-flex items-center gap-2">
          <span className="habit-timeline-legend-dot-done w-2 h-2 rounded-full bg-ink inline-block" /> Done
        </span>
      </div>

      {menu && (
        <ContextMenu
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          items={[
            { type: 'item', label: 'Edit', onClick: () => onEdit(menu.habitId) },
            { type: 'separator' },
            { type: 'item', label: 'Delete', destructive: true, onClick: () => onDelete(menu.habitId) },
          ]}
        />
      )}
    </div>
  );
}
