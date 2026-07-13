import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { getPhrase } from '../utils/phrases';
import { useSync } from '../hooks/useSync';
import { HabitBlock } from '../components/habits/HabitBlock';
import { HabitForm, HabitFormValues } from '../components/habits/HabitForm';
import { Button } from '../components/ui/Button';
import {
  fetchHabits,
  apiCreateHabit,
  apiUpdateHabit,
  apiDeleteHabit,
  apiToggleHabitCompletion,
  type ApiHabit,
} from '../api/client';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function HabitsPage() {
  const phrase = useMemo(() => getPhrase('habits'), []);
  const today = useMemo(() => startOfDay(new Date()), []);
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();

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

  const handleDelete = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    apiDeleteHabit(id).catch(() => invalidate());
  };

  const handleToggle = (id: string) => (isoDate: string, isCompleted: boolean) => {
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
  };

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

      {habits.map((habit) =>
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
            onToggle={handleToggle(habit.id)}
            onEdit={() => setEditingId(habit.id)}
            onDelete={() => handleDelete(habit.id)}
          />
        ),
      )}

      <div className="mt-12">
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
