import { useMemo, useState } from 'react';
import { HabitDot } from './HabitDot';
import { HabitMonthGrid } from './HabitMonthGrid';
import { fmtISO, startOfDay, type WeekStart } from '../../utils/date';
import { buildHabitTree, dayState, habitsToToggle, parentToggleTarget } from '../../utils/habitTree';
import type { ApiHabit } from '../../api/client';

// Styleguide specimen for the habit system. It drives the real HabitDot and
// HabitMonthGrid components rather than reimplementing them, so this card cannot
// drift away from what the Habits page actually renders.
export function HabitSpecimen({ weekStart }: { weekStart: WeekStart }) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const [habits, setHabits] = useState<ApiHabit[]>(() => {
    const ago = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      return fmtISO(d);
    };
    const base = { parentId: null, groupId: null, orderValue: 0, completions: [] };
    return [
      { ...base, id: 'run', name: 'Morning run', completions: [ago(1), ago(2), ago(4), ago(5), ago(6), ago(8)] },
      // A parent with sub-habits: partly-done days render as half circles.
      { ...base, id: 'water', name: "Beber 4L d'água", orderValue: 1 },
      { ...base, id: '1L', name: '1L', parentId: 'water', completions: [ago(0), ago(1), ago(2), ago(3)] },
      { ...base, id: '2L', name: '2L', parentId: 'water', orderValue: 1, completions: [ago(1), ago(2), ago(3)] },
      { ...base, id: '3L', name: '3L', parentId: 'water', orderValue: 2, completions: [ago(3)] },
    ];
  });

  const roots = useMemo(() => buildHabitTree(habits), [habits]);

  const toggle = (nodeId: string, iso: string) => {
    const node = roots.find((r) => r.id === nodeId) ?? roots.flatMap((r) => r.children).find((c) => c.id === nodeId);
    if (!node) return;

    const target = parentToggleTarget(node, iso);
    const ids = new Set(habitsToToggle(node, iso, target).map((h) => h.id));
    setHabits((prev) =>
      prev.map((h) =>
        ids.has(h.id)
          ? {
              ...h,
              completions: target
                ? [...h.completions, iso]
                : h.completions.filter((c) => c !== iso),
            }
          : h,
      ),
    );
  };

  return (
    <div className="habit-specimen">
      <span className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
        Day states
      </span>
      <div className="flex items-center gap-6">
        {(['empty', 'half', 'full'] as const).map((state) => (
          <div key={state} className="flex items-center gap-2">
            <span className="relative inline-block" style={{ width: 24, height: 24 }}>
              <HabitDot state={state} />
            </span>
            <span className="text-[10px] text-ink-light">{state}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-light opacity-70">
        A parent habit shows <em>half</em> when only some of its sub-habits are done that day.
      </p>

      <div className="mt-8 border-t border-border pt-6">
        <span className="mb-4 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
          Calendar grid view
        </span>
        <div className="flex flex-col gap-8 overflow-x-auto pb-1 sm:flex-row sm:gap-12">
          {roots.map((habit) => (
            <div key={habit.id} className="min-w-0">
              <div className="mb-1 flex h-6 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: 'var(--color-ink-lighter)' }}
                />
                <span className="truncate text-sm leading-6 text-ink">{habit.name}</span>
              </div>
              <HabitMonthGrid
                year={today.getFullYear()}
                month={today.getMonth()}
                today={today}
                weekStart={weekStart}
                label={habit.name}
                stateFor={(iso) => dayState(habit, iso)}
                onToggle={(iso) => toggle(habit.id, iso)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
