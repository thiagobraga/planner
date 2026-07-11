import { useMemo, useState } from 'react';
import { getPhrase } from '../utils/phrases';

interface Habit {
  id: string;
  name: string;
  note?: string;
  seedOffsets: number[];
}

const HABITS: Habit[] = [
  {
    id: 'wake-6',
    name: 'Wake up at 6 am',
    note: 'A clear morning, on purpose.',
    seedOffsets: [
      0, 1, 2, 3, 4, 5, 6, 7, 8,
      10, 11, 12, 13, 14,
      16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
      30, 31,
      33, 34, 35, 36, 37, 38,
      41, 42, 43, 44,
      46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
      71, 72, 73,
      76, 77, 78, 79, 80,
    ],
  },
];

const WEEKS = 12;
const CELL = 16;
const GAP = 6;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildSeed(today: Date, offsets: number[]): Set<string> {
  return new Set(offsets.map((o) => fmtISO(addDays(today, -o))));
}

function effectiveCompleted(seed: Set<string>, overrides: Set<string>): (iso: string) => boolean {
  return (iso) => {
    const inSeed = seed.has(iso);
    const flipped = overrides.has(iso);
    return inSeed !== flipped;
  };
}

function currentChainLength(today: Date, isDone: (iso: string) => boolean): number {
  let n = 0;
  let d = today;
  while (isDone(fmtISO(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function longestChainLength(isDone: (iso: string) => boolean, today: Date, lookback: number): number {
  let best = 0;
  let run = 0;
  for (let i = lookback; i >= 0; i--) {
    if (isDone(fmtISO(addDays(today, -i)))) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function thirtyDayRate(isDone: (iso: string) => boolean, today: Date): number {
  let n = 0;
  for (let i = 0; i < 30; i++) {
    if (isDone(fmtISO(addDays(today, -i)))) n++;
  }
  return Math.round((n / 30) * 100);
}

function HabitBlock({ habit }: { habit: Habit }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const seed = useMemo(() => buildSeed(today, habit.seedOffsets), [today, habit.seedOffsets]);
  const [overrides, setOverrides] = useState<Set<string>>(() => new Set());

  const isDone = useMemo(() => effectiveCompleted(seed, overrides), [seed, overrides]);

  const cells = useMemo(() => {
    // Mon=0..Sun=6
    const todayCol = (today.getDay() + 6) % 7;
    const lastSunday = addDays(today, 6 - todayCol);
    const total = WEEKS * 7;
    const out: { date: Date; iso: string; col: number; row: number; future: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const date = addDays(lastSunday, -(total - 1 - i));
      out.push({
        date,
        iso: fmtISO(date),
        col: i % 7,
        row: Math.floor(i / 7),
        future: date.getTime() > today.getTime(),
      });
    }
    return out;
  }, [today]);

  const todayISO = fmtISO(today);
  const chain = currentChainLength(today, isDone);
  const longest = longestChainLength(isDone, today, WEEKS * 7 - 1);
  const rate = thirtyDayRate(isDone, today);

  const toggle = (iso: string, future: boolean) => {
    if (future) return;
    setOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  // Capsule Rule: border-radius depends on neighboring cells' completion state at render time —
  // must stay as inline style.
  const cellShape = (iso: string, col: number, row: number, completed: boolean) => {
    if (!completed) return { borderRadius: '50%' };
    const leftIso = col > 0 ? cells[row * 7 + col - 1].iso : null;
    const rightIso = col < 6 ? cells[row * 7 + col + 1].iso : null;
    const leftDone = leftIso && isDone(leftIso);
    const rightDone = rightIso && isDone(rightIso);
    const l = leftDone ? '0' : '50%';
    const r = rightDone ? '0' : '50%';
    return { borderRadius: `${l} ${r} ${r} ${l}` };
  };

  return (
    <section className="mt-12">
      {/* Habit header line */}
      <div className="flex items-baseline gap-[14px]">
        <h2 className="text-base leading-6 font-semibold text-ink">
          {habit.name}
        </h2>
        {habit.note && (
          <span className="text-xs text-ink-light italic">
            {habit.note}
          </span>
        )}
      </div>

      {/* Chain count + stats */}
      <div className="flex items-end gap-6 mt-6 mb-6">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[48px] leading-[48px] font-semibold tracking-[-0.02em] ${chain > 0 ? 'text-ink' : 'text-ink-light'}`}
          >
            {chain}
          </span>
          <span className="text-[11px] tracking-widest uppercase text-ink-light font-medium">
            day{chain === 1 ? '' : 's'} unbroken
          </span>
        </div>

        <div className="flex-1 flex gap-5 justify-end text-xs text-ink-light pb-1">
          <span>
            longest <span className="text-ink font-medium">{longest}</span>
          </span>
          <span>
            last 30 days <span className="text-ink font-medium">{rate}%</span>
          </span>
        </div>
      </div>

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
          const completed = !future && isDone(iso);
          const isToday = iso === todayISO;
          const shape = cellShape(iso, col, row, completed);

          if (future) {
            return <span key={iso} aria-hidden="true" />;
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => toggle(iso, future)}
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
    </section>
  );
}

export function HabitsPage() {
  const phrase = useMemo(() => getPhrase('habits'), []);
  return (
    <div className="max-w-162">
      <header className="sticky-page-header">
        <h1 className="text-lg leading-6 font-semibold text-ink">
          Habits
        </h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60">
          {phrase}
        </p>
      </header>

      {HABITS.map((h) => (
        <HabitBlock key={h.id} habit={h} />
      ))}
    </div>
  );
}
