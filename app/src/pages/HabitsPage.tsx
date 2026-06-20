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
    <section style={{ marginTop: '48px' }}>
      {/* Habit header line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
        <h2
          style={{
            fontFamily: '"Lora", serif',
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: 600,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          {habit.name}
        </h2>
        {habit.note && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-ink-light)',
              fontStyle: 'italic',
            }}
          >
            {habit.note}
          </span>
        )}
      </div>

      {/* Chain count + stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          marginTop: '24px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: '"Lora", serif',
              fontSize: '48px',
              lineHeight: '48px',
              fontWeight: 600,
              color: chain > 0 ? 'var(--color-ink)' : 'var(--color-ink-light)',
              letterSpacing: '-0.02em',
            }}
          >
            {chain}
          </span>
          <span
            style={{
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              fontWeight: 500,
            }}
          >
            day{chain === 1 ? '' : 's'} unbroken
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '20px',
            justifyContent: 'flex-end',
            fontSize: '12px',
            color: 'var(--color-ink-light)',
            paddingBottom: '4px',
          }}
        >
          <span>
            longest <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{longest}</span>
          </span>
          <span>
            last 30 days <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{rate}%</span>
          </span>
        </div>
      </div>

      {/* Day labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${CELL}px)`,
          columnGap: `${GAP}px`,
          marginBottom: '6px',
          fontSize: '10px',
          color: 'var(--color-ink-light)',
          letterSpacing: '0.05em',
        }}
      >
        {DAY_LABELS.map((d, i) => (
          <span key={i} style={{ textAlign: 'center', opacity: 0.7 }}>
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${CELL}px)`,
          gridAutoRows: `${CELL}px`,
          columnGap: `${GAP}px`,
          rowGap: `${GAP}px`,
        }}
      >
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
              style={{
                width: `${CELL}px`,
                height: `${CELL}px`,
                padding: 0,
                border: isToday
                  ? `1.5px solid var(--color-ink)`
                  : completed
                  ? 'none'
                  : `1px solid var(--color-dot)`,
                background: completed ? 'var(--color-ink)' : 'transparent',
                cursor: 'pointer',
                ...shape,
                transition: 'background 120ms ease-out, border-radius 120ms ease-out',
              }}
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
    <div style={{ maxWidth: '648px' }}>
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '18px',
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        Habits
      </h1>
      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          color: 'var(--color-ink-light)',
          opacity: 0.6,
          margin: 0,
        }}
      >
        {phrase}
      </p>

      {HABITS.map((h) => (
        <HabitBlock key={h.id} habit={h} />
      ))}
    </div>
  );
}
