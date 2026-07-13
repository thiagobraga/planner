import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { getPhrase } from '../utils/phrases';
import { useSync } from '../hooks/useSync';
import { HabitBlock } from '../components/habits/HabitBlock';
import { HabitForm, HabitFormValues } from '../components/habits/HabitForm';
import { HabitTimeline } from '../components/habits/HabitTimeline';
import { Button } from '../components/ui/Button';
import {
  fetchHabits,
  apiCreateHabit,
  apiUpdateHabit,
  apiDeleteHabit,
  apiToggleHabitCompletion,
  PROJECT_COLORS,
  type ApiHabit,
} from '../api/client';

type HabitsView = 'timeline' | 'list';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function habitColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length].hex;
}

export function HabitsPage() {
  const phrase = useMemo(() => getPhrase('habits'), []);
  const today = useMemo(() => startOfDay(new Date()), []);
  const queryClient = useQueryClient();

  const [view, setView] = useState<HabitsView>('timeline');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [todaySignal, setTodaySignal] = useState(0);

  const { data: habits = [] } = useQuery({ queryKey: ['habits'], queryFn: fetchHabits });

  const setHabits = useCallback(
    (updater: (prev: ApiHabit[]) => ApiHabit[]) => {
      queryClient.setQueryData<ApiHabit[]>(['habits'], (prev) => updater(prev ?? []));
    },
    [queryClient],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
  }, [queryClient]);

  useSync(
    useCallback(
      (event) => {
        if (event.entityType !== 'habit' && event.entityType !== 'habit_completion') return;
        invalidate();
      },
      [invalidate],
    ),
  );

  const handleCreate = (values: HabitFormValues) => {
    setCreating(false);
    apiCreateHabit(values)
      .then((created) => {
        setHabits((prev) =>
          prev.some((h) => h.id === created.id) ? prev : [...prev, created],
        );
      })
      .catch(() => invalidate());
  };

  const handleUpdate = (id: string) => (values: HabitFormValues) => {
    setEditingId(undefined);
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, name: values.name, note: values.note } : h)),
    );
    apiUpdateHabit(id, { name: values.name, note: values.note ?? null }).catch(() => invalidate());
  };

  const handleDelete = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    apiDeleteHabit(id).catch(() => invalidate());
  }, [setHabits, invalidate]);

  const handleToggle = useCallback((id: string, isoDate: string, isCompleted: boolean) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const completions = isCompleted
          ? [...h.completions, isoDate]
          : h.completions.filter((c) => c !== isoDate);
        return { ...h, completions };
      }),
    );
    apiToggleHabitCompletion(id, isoDate, isCompleted).catch(() => invalidate());
  }, [setHabits, invalidate]);

  const timelineHabits = useMemo(
    () =>
      habits.map((h, i) => ({
        id: h.id,
        name: h.name,
        note: h.note,
        color: habitColor(i),
        completions: new Set(h.completions),
      })),
    [habits],
  );

  const editingHabit = habits.find((h) => h.id === editingId);

  return (
    <div className={`habits-page ${view === 'timeline' ? 'max-w-none' : 'max-w-162'}`}>
      <header className="sticky-page-header">
        <div className="habits-page-header-content flex items-start gap-4">
          <div className="habits-page-header-title flex-1 min-w-0">
            <h1 className="text-lg leading-6 font-semibold text-ink">
              Habits
            </h1>
            <p className="text-[13px] leading-6 text-ink-light opacity-60">
              {phrase}
            </p>
          </div>

          {view === 'timeline' && (
            <Button variant="secondary" onClick={() => setTodaySignal((n) => n + 1)}>
              Today
            </Button>
          )}

          {/* Segmented Timeline / List toggle */}
          <div className="habits-page-view-toggle inline-flex items-center rounded-[8px] border border-border overflow-hidden">
            {([
              { mode: 'timeline' as const, label: 'Timeline view', Icon: LayoutGrid },
              { mode: 'list' as const, label: 'List view', Icon: List },
            ]).map(({ mode, label, Icon }, i) => (
              <button
                key={mode}
                type="button"
                aria-label={label}
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={`habits-page-view-toggle-button inline-flex items-center justify-center h-9 w-10 transition-colors duration-[var(--motion-fast)] ${
                  i > 0 ? 'border-l border-border' : ''
                } ${view === mode ? 'bg-dot/60 text-ink' : 'bg-transparent text-ink-light hover:bg-dot/30'}`}
              >
                <Icon size={15} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === 'timeline' ? (
        <>
          <HabitTimeline
            habits={timelineHabits}
            today={today}
            todaySignal={todaySignal}
            onToggle={handleToggle}
            onEdit={setEditingId}
            onDelete={handleDelete}
          />

          {editingHabit && (
            <div className="habits-page-edit-form-container max-w-162">
              <HabitForm
                key={editingHabit.id}
                initialValues={{ name: editingHabit.name, note: editingHabit.note }}
                submitLabel="Save"
                onSubmit={handleUpdate(editingHabit.id)}
                onCancel={() => setEditingId(undefined)}
              />
            </div>
          )}
        </>
      ) : (
        habits.map((habit) =>
          editingId === habit.id ? (
            <HabitForm
              key={habit.id}
              initialValues={{ name: habit.name, note: habit.note }}
              submitLabel="Save"
              onSubmit={handleUpdate(habit.id)}
              onCancel={() => setEditingId(undefined)}
            />
          ) : (
            <HabitBlock
              key={habit.id}
              name={habit.name}
              note={habit.note}
              completions={new Set(habit.completions)}
              today={today}
              onToggle={(iso, done) => handleToggle(habit.id, iso, done)}
              onEdit={() => setEditingId(habit.id)}
              onDelete={() => handleDelete(habit.id)}
            />
          ),
        )
      )}

      <div className="habits-page-new-habit-container mt-12 max-w-162">
        {creating ? (
          <HabitForm
            submitLabel="Create"
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <Button variant="tertiary" leftIcon={<Plus />} onClick={() => setCreating(true)}>
            New habit
          </Button>
        )}
      </div>
    </div>
  );
}
