import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { MonthStrip } from '../MonthStrip';
import { fmtISO } from './HabitGrid';

const LOOKBACK_WEEKS = 26;
const CELL_W = 28;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

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
  // Increment to smooth-scroll the timeline back to today (e.g. from a header button).
  todaySignal?: number;
  onToggle: (habitId: string, isoDate: string, isCompleted: boolean) => void;
  onEdit: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}

interface DayCell {
  iso: string;
  letter: string;
  dayOfMonth: number;
  monthKey: string; // YYYY-MM
}

// Horizontal habit tracker: one row per habit, one column per day.
// Done days render as filled dots in the habit color; consecutive done days
// are joined by a connector line. Scrolls horizontally, pinned habit column.
export function HabitTimeline({ habits, today, todaySignal, onToggle, onEdit, onDelete }: HabitTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ habitId: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const days = useMemo<DayCell[]>(() => {
    const total = LOOKBACK_WEEKS * 7;
    const out: DayCell[] = [];
    for (let i = total - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      out.push({
        iso: fmtISO(date),
        letter: DAY_LETTERS[date.getDay()],
        dayOfMonth: date.getDate(),
        monthKey: fmtISO(date).slice(0, 7),
      });
    }
    return out;
  }, [today]);

  // First day-column index of each month present in the range
  const monthFirstIndex = useMemo(() => {
    const seen = new Map<string, number>();
    days.forEach((d, i) => {
      if (!seen.has(d.monthKey)) seen.set(d.monthKey, i);
    });
    return seen;
  }, [days]);

  const todayISO = fmtISO(today);

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ left: index * CELL_W, behavior: 'smooth' });
  };
  const scrollToEnd = (smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleMonthChange = (year: number, month: number) => {
    setSelected({ year, month });
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const index = monthFirstIndex.get(key);
    if (index !== undefined) {
      scrollToIndex(index);
    } else if (key > todayISO.slice(0, 7)) {
      scrollToEnd();
    } else {
      scrollToIndex(0);
    }
  };

  // Start at today (right end)
  useEffect(() => scrollToEnd(false), []);

  useEffect(() => {
    if (todaySignal) {
      setSelected({ year: today.getFullYear(), month: today.getMonth() });
      scrollToEnd();
    }
  }, [todaySignal, today]);

  return (
    <div>
      {/* Month navigator (shared with Monthly page) */}
      <MonthStrip
        year={selected.year}
        month={selected.month}
        onChange={handleMonthChange}
        className="mt-6"
      />

      {/* Timeline table */}
      <div ref={scrollRef} className="mt-6 overflow-x-auto border-t border-border">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-10 shrink-0 w-32 bg-cream flex items-end pb-2 pr-3 border-r border-border">
              <span className="text-[10px] tracking-[0.08em] uppercase text-ink-light font-medium">
                Habit
              </span>
            </div>
            {days.map((d) => (
              <div
                key={d.iso}
                className="shrink-0 flex flex-col items-center justify-end gap-1 pb-2 pt-3"
                style={{ width: CELL_W }}
              >
                <span className="text-[10px] leading-none text-ink-light opacity-70">{d.letter}</span>
                <span
                  className={`text-[10px] leading-none ${
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
            <div key={habit.id} className="flex border-b border-border group">
              <div className="sticky left-0 z-10 shrink-0 w-32 bg-cream flex items-center gap-2 pr-2 border-r border-border h-14">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: habit.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 truncate text-sm text-ink" title={habit.note}>
                  {habit.name}
                </span>
                <button
                  type="button"
                  aria-label={`Options for ${habit.name}`}
                  className="shrink-0 p-1 rounded-[4px] text-ink-light opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink hover:bg-dot/30 cursor-pointer transition-opacity duration-75"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenu({ habitId: habit.id, x: rect.left, y: rect.bottom + 4 });
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {days.map((d, i) => {
                const done = habit.completions.has(d.iso);
                const prevDone = i > 0 && done && habit.completions.has(days[i - 1].iso);
                const nextDone = i < days.length - 1 && done && habit.completions.has(days[i + 1].iso);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => onToggle(habit.id, d.iso, !done)}
                    aria-label={`${habit.name} ${d.iso}${done ? ' completed' : ' not completed'}`}
                    aria-pressed={done}
                    className="relative shrink-0 h-14 p-0 bg-transparent border-none cursor-pointer"
                    style={{ width: CELL_W }}
                  >
                    {/* connector halves */}
                    {prevDone && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 -translate-y-1/2 left-0 h-[2px]"
                        style={{ width: CELL_W / 2, background: habit.color }}
                      />
                    )}
                    {nextDone && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 -translate-y-1/2 right-0 h-[2px]"
                        style={{ width: CELL_W / 2, background: habit.color }}
                      />
                    )}
                    {/* dot */}
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
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
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-ink-light">
        <span className="inline-flex items-center gap-2">
          <span className="w-[5px] h-[5px] rounded-full bg-dot inline-block" /> Not done
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ink inline-block" /> Done
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
