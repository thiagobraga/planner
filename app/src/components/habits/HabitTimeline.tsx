import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { MonthSelector } from '../monthly/MonthSelector';
import { StripNavigator } from '../ui/StripNavigator';
import { fmtISO } from './HabitGrid';

const CELL_W = 24;
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
  const daysViewportRef = useRef<HTMLDivElement>(null);
  const [canPagePrevious, setCanPagePrevious] = useState(false);
  const [canPageNext, setCanPageNext] = useState(false);

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

  const updatePagingState = useCallback(() => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    setCanPagePrevious(viewport.scrollLeft > 1);
    setCanPageNext(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ left: 0 });
    updatePagingState();

    const resizeObserver = new ResizeObserver(updatePagingState);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [days, updatePagingState]);

  const pageDays = (direction: -1 | 1) => {
    const viewport = daysViewportRef.current;
    if (!viewport) return;

    const visibleCells = Math.max(1, Math.floor(viewport.clientWidth / CELL_W));
    viewport.scrollBy({ left: direction * visibleCells * CELL_W, behavior: 'smooth' });
  };

  return (
    <div className="habit-timeline">
      {/* Month navigator (shared with Monthly page) */}
      <MonthSelector
        year={selected.year}
        month={selected.month}
        onChange={(year, month) => setSelected({ year, month })}
        className="mt-6"
      />

      <div className="habit-timeline-table mt-6 flex min-w-0 items-start gap-2">
        <div className="habit-timeline-labels w-48 shrink-0 min-w-0">
          <div className="h-12" aria-hidden="true" />
          {habits.map((habit) => (
            <div key={habit.id} className="habit-timeline-row-label group flex h-6 min-w-0 items-center gap-2 pr-2">
              <span
                className="habit-timeline-row-color-dot h-2 w-2 shrink-0 rounded-full"
                style={{ background: habit.color }}
                aria-hidden="true"
              />
              <span className="habit-timeline-row-name min-w-0 flex-1 truncate text-sm leading-6 text-ink" title={habit.note}>
                {habit.name}
              </span>
              <button
                type="button"
                aria-label={`Options for ${habit.name}`}
                className="habit-timeline-row-options flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-ink-light opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink hover:bg-dot/30 cursor-pointer transition-opacity duration-75"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu({ habitId: habit.id, x: rect.left, y: rect.bottom + 4 });
                }}
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
        </div>

        <StripNavigator
          direction="previous"
          aria-label="Previous days"
          disabled={!canPagePrevious}
          onClick={() => pageDays(-1)}
          className="habit-timeline-days-prev mt-1.5"
        />

        <div
          ref={daysViewportRef}
          onScroll={updatePagingState}
          className="habit-timeline-days-viewport min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth"
        >
          <div className="habit-timeline-table-inner" style={{ width: days.length * CELL_W }}>
            <div className="habit-timeline-header flex h-12">
            {days.map((d) => (
              <div
                key={d.iso}
                className={`habit-timeline-header-day flex h-12 shrink-0 flex-col items-center justify-center ${d.future ? 'opacity-40' : ''}`}
                style={{ width: CELL_W }}
              >
                <span className="habit-timeline-header-day-letter flex h-6 items-center text-[10px] leading-6 text-ink-light opacity-70">{d.letter}</span>
                <span
                  className={`habit-timeline-header-day-number flex h-6 items-center text-[10px] leading-6 ${
                    d.iso === todayISO ? 'text-ink font-semibold' : 'text-ink-light'
                  }`}
                >
                  {d.dayOfMonth}
                </span>
              </div>
            ))}
          </div>

          {habits.map((habit) => (
            <div key={habit.id} className="habit-timeline-row flex h-6">
              {days.map((d, i) => {
                if (d.future) {
                  return (
                    <span
                      key={d.iso}
                      aria-hidden="true"
                      className="habit-timeline-day-placeholder h-6 shrink-0"
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
                    className="habit-timeline-day-cell relative h-6 shrink-0 p-0 bg-transparent border-none cursor-pointer"
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

        <StripNavigator
          direction="next"
          aria-label="Next days"
          disabled={!canPageNext}
          onClick={() => pageDays(1)}
          className="habit-timeline-days-next mt-1.5"
        />
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
