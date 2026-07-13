import { useMemo } from 'react';

export const WEEKS = 12;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface HabitGridProps {
  completions: Set<string>;
  today: Date;
  onToggle: (isoDate: string, isCompleted: boolean) => void;
}

// 12-week dot-based grid. Empty cells are border-dot, filled cells bg-ink,
// today has a 1.5px ink outline. Consecutive completed days fuse into a capsule.
export function HabitGrid({ completions, today, onToggle }: HabitGridProps) {
  const cells = useMemo(() => {
    // Mon=0..Sun=6
    const todayCol = (today.getDay() + 6) % 7;
    const lastSunday = addDays(today, 6 - todayCol);
    const total = WEEKS * 7;
    const out: { iso: string; col: number; row: number; future: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const date = addDays(lastSunday, -(total - 1 - i));
      out.push({
        iso: fmtISO(date),
        col: i % 7,
        row: Math.floor(i / 7),
        future: date.getTime() > today.getTime(),
      });
    }
    return out;
  }, [today]);

  const todayISO = fmtISO(today);

  // Capsule Rule: border-radius depends on neighboring cells' completion state at render time —
  // must stay as inline style.
  const cellShape = (col: number, row: number, completed: boolean) => {
    if (!completed) return { borderRadius: '50%' };
    const leftDone = col > 0 && completions.has(cells[row * 7 + col - 1].iso);
    const rightDone = col < 6 && completions.has(cells[row * 7 + col + 1].iso);
    const l = leftDone ? '0' : '50%';
    const r = rightDone ? '0' : '50%';
    return { borderRadius: `${l} ${r} ${r} ${l}` };
  };

  return (
    <div>
      {/* Day labels */}
      <div className="grid [grid-template-columns:repeat(7,16px)] gap-x-[6px] mb-[6px] text-[10px] text-ink-light tracking-wider">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="text-center opacity-70">
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="grid [grid-template-columns:repeat(7,16px)] [grid-auto-rows:16px] gap-[6px]">
        {cells.map(({ iso, col, row, future }) => {
          if (future) {
            return <span key={iso} aria-hidden="true" />;
          }

          const completed = completions.has(iso);
          const isToday = iso === todayISO;
          const shape = cellShape(col, row, completed);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onToggle(iso, !completed)}
              aria-label={`${iso}${completed ? ' completed' : ' not completed'}${isToday ? ' (today)' : ''}`}
              aria-pressed={completed}
              className={`w-4 h-4 p-0 cursor-pointer ${
                isToday
                  ? '[border:1.5px_solid_var(--color-ink)] bg-transparent'
                  : completed
                  ? 'border-none bg-ink'
                  : 'border border-dot bg-transparent'
              }`}
              style={{ ...shape, transition: 'background 120ms ease-out, border-radius 120ms ease-out' }}
            />
          );
        })}
      </div>
    </div>
  );
}
