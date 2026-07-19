import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { getPhrase } from '../utils/phrases';
import { useSync } from '../hooks/useSync';
import { HabitTimeline, type HabitEditTarget } from '../components/habits/HabitTimeline';
import { HabitCalendar } from '../components/habits/HabitCalendar';
import { useHabitDrag } from '../hooks/useHabitDrag';
import { isEchoedMove } from '../utils/moveEcho';
import { Button } from '../components/ui/Button';
import { startOfDay } from '../utils/date';
import { flattenHabits, type HabitNode } from '../utils/habitTree';
import {
  loadCollapsedHabitIds,
  pruneCollapsedHabitIds,
  saveCollapsedHabitIds,
} from '../utils/habitCollapseStorage';
import {
  buildHabitSections,
  habitsToToggle,
  parentToggleTarget,
} from '../utils/habitTree';
import type { LucideProps } from 'lucide-react';

import {
  fetchHabits,
  fetchHabitGroups,
  apiCreateHabit,
  apiUpdateHabit,
  apiDeleteHabit,
  apiToggleHabitCompletion,
  apiCreateHabitGroup,
  apiUpdateHabitGroup,
  apiDeleteHabitGroup,
  type ApiHabit,
  type ApiHabitGroup,
} from '../api/client';

function DotsConnectedIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size ?? 24}
      height={props.size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

type HabitsView = 'timeline' | 'calendar';

// Rows created in the UI carry a temp id until the server assigns a real one.
// Every handler checks this prefix before calling the API.
let tempCounter = 0;
function tempId() {
  return `temp-habit-${++tempCounter}`;
}
function isTemp(id: string) {
  return id.startsWith('temp-');
}

export function HabitsPage() {
  const phrase = useMemo(() => getPhrase('habits'), []);
  const today = useMemo(() => startOfDay(new Date()), []);
  const queryClient = useQueryClient();

  const [view, setView] = useState<HabitsView>('timeline');
  const [editing, setEditing] = useState<HabitEditTarget>();
  const [todaySignal, setTodaySignal] = useState(0);
  const [collapsedHabitIds, setCollapsedHabitIds] = useState<Set<string>>(() => loadCollapsedHabitIds());
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const { data: habits = [], isSuccess: habitsLoaded } = useQuery({ queryKey: ['habits'], queryFn: fetchHabits });
  const { data: groups = [], isSuccess: groupsLoaded } = useQuery({
    queryKey: ['habitGroups'],
    queryFn: fetchHabitGroups,
  });

  const setHabits = useCallback(
    (updater: (prev: ApiHabit[]) => ApiHabit[]) => {
      queryClient.setQueryData<ApiHabit[]>(['habits'], (prev) => updater(prev ?? []));
    },
    [queryClient],
  );

  const setGroups = useCallback(
    (updater: (prev: ApiHabitGroup[]) => ApiHabitGroup[]) => {
      queryClient.setQueryData<ApiHabitGroup[]>(['habitGroups'], (prev) => updater(prev ?? []));
    },
    [queryClient],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['habitGroups'] });
  }, [queryClient]);

  useSync(
    useCallback(
      (event) => {
        if (
          event.entityType !== 'habit' &&
          event.entityType !== 'habit_completion' &&
          event.entityType !== 'habit_group'
        ) {
          return;
        }
        // Our own habit or group move, still reconciling.
        if (isEchoedMove(event)) return;
        invalidate();
      },
      [invalidate],
    ),
  );

  const sections = useMemo(() => buildHabitSections(habits, groups), [habits, groups]);

  // Habit and group drags both run on the shell-level DndContext, so a habit can
  // be dragged between groups - and, in Calendar mode, between cards - without
  // each section owning a context of its own.
  const { activeDragId } = useHabitDrag({
    habits,
    groups,
    setHabits: useCallback((next: ApiHabit[]) => setHabits(() => next), [setHabits]),
    setGroups: useCallback((next: ApiHabitGroup[]) => setGroups(() => next), [setGroups]),
    onError: invalidate,
  });
  const habitIds = useMemo(() => {
    const ids = new Set<string>();
    const collect = (nodes: HabitNode[]) => {
      for (const { node } of flattenHabits(nodes)) ids.add(node.id);
    };
    collect(sections.ungrouped);
    for (const section of sections.groups) collect(section.habits);
    return ids;
  }, [sections]);

  useEffect(() => {
    if (!habitsLoaded || !groupsLoaded) return;

    setCollapsedHabitIds((prev) => {
      const next = pruneCollapsedHabitIds(prev, habitIds);
      return next.size === prev.size ? prev : next;
    });
  }, [habitsLoaded, groupsLoaded, habitIds]);

  useEffect(() => {
    saveCollapsedHabitIds(collapsedHabitIds);
  }, [collapsedHabitIds]);

  const toggleHabitCollapsed = useCallback((id: string) => {
    setCollapsedHabitIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Only leaf habits store completions, so a click on a parent fans out to its
  // sub-habits. Everything moves to the same target state in one gesture.
  const handleToggleDay = useCallback(
    (node: HabitNode, iso: string) => {
      const target = parentToggleTarget(node, iso);
      const leaves = habitsToToggle(node, iso, target);
      if (leaves.length === 0) return;

      const ids = new Set(leaves.map((leaf) => leaf.id));
      setHabits((prev) =>
        prev.map((habit) => {
          if (!ids.has(habit.id)) return habit;
          const completions = target
            ? [...habit.completions, iso]
            : habit.completions.filter((c) => c !== iso);
          return { ...habit, completions };
        }),
      );

      // A temp row has no server id yet; its completion is applied on create.
      Promise.all(
        leaves
          .filter((leaf) => !isTemp(leaf.id))
          .map((leaf) => apiToggleHabitCompletion(leaf.id, iso, target)),
      ).catch(() => invalidate());
    },
    [setHabits, invalidate],
  );

  const handleAddHabit = useCallback(
    ({ groupId, parentId }: { groupId: string | null; parentId?: string }) => {
      const id = tempId();
      // A sub-habit inherits its parent's group, so it never carries its own.
      const effectiveGroupId = parentId ? null : groupId;
      setHabits((prev) => {
        const siblings = prev.filter(
          (h) => h.parentId === (parentId ?? null) && h.groupId === effectiveGroupId,
        );
        const orderValue = siblings.reduce((max, h) => Math.max(max, h.orderValue + 1), 0);
        return [
          ...prev,
          {
            id,
            name: '',
            parentId: parentId ?? null,
            groupId: effectiveGroupId,
            orderValue,
            completions: [],
          },
        ];
      });
      setEditing({ kind: 'habit', id });
    },
    [setHabits],
  );

  const handleAddGroup = useCallback(() => {
    const id = tempId();
    setGroups((prev) => [
      ...prev,
      { id, name: '', orderValue: prev.reduce((max, g) => Math.max(max, g.orderValue + 1), 0) },
    ]);
    setEditing({ kind: 'group', id });
  }, [setGroups]);

  const removeHabitLocally = useCallback(
    (id: string) => setHabits((prev) => prev.filter((h) => h.id !== id && h.parentId !== id)),
    [setHabits],
  );

  const handleCommitEdit = useCallback(
    (target: HabitEditTarget, name: string) => {
      setEditing(undefined);

      if (target.kind === 'group') {
        if (!name) {
          setGroups((prev) => prev.filter((g) => g.id !== target.id));
          if (!isTemp(target.id)) apiDeleteHabitGroup(target.id).catch(() => invalidate());
          return;
        }

        setGroups((prev) => prev.map((g) => (g.id === target.id ? { ...g, name } : g)));

        if (isTemp(target.id)) {
          apiCreateHabitGroup({ name })
            .then((created) => {
              setGroups((prev) => prev.map((g) => (g.id === target.id ? created : g)));
              // Habits parked on the temp group follow it to the real id.
              setHabits((prev) =>
                prev.map((h) => (h.groupId === target.id ? { ...h, groupId: created.id } : h)),
              );
            })
            .catch(() => invalidate());
        } else {
          apiUpdateHabitGroup(target.id, { name }).catch(() => invalidate());
        }
        return;
      }

      // An empty name means the row was abandoned - drop it.
      if (!name) {
        removeHabitLocally(target.id);
        if (!isTemp(target.id)) apiDeleteHabit(target.id).catch(() => invalidate());
        return;
      }

      const existing = habits.find((h) => h.id === target.id);
      setHabits((prev) => prev.map((h) => (h.id === target.id ? { ...h, name } : h)));

      if (isTemp(target.id)) {
        apiCreateHabit({
          name,
          parentId: existing?.parentId ?? null,
          // A temp group id would not resolve server-side; the group create
          // reassigns these habits once it returns.
          groupId: existing?.groupId && !isTemp(existing.groupId) ? existing.groupId : null,
        })
          .then((created) => {
            setHabits((prev) => prev.map((h) => (h.id === target.id ? created : h)));
          })
          .catch(() => invalidate());
      } else {
        apiUpdateHabit(target.id, { name }).catch(() => invalidate());
      }
    },
    [habits, setHabits, setGroups, removeHabitLocally, invalidate],
  );

  // Escape on a brand-new row discards it; on an existing row it just stops editing.
  const handleCancelEdit = useCallback(
    (target: HabitEditTarget) => {
      setEditing(undefined);
      if (!isTemp(target.id)) return;
      if (target.kind === 'group') {
        setGroups((prev) => prev.filter((g) => g.id !== target.id));
      } else {
        removeHabitLocally(target.id);
      }
    },
    [setGroups, removeHabitLocally],
  );

  const handleDelete = useCallback(
    (target: HabitEditTarget) => {
      if (target.kind === 'group') {
        setGroups((prev) => prev.filter((g) => g.id !== target.id));
        // Habits survive; the server ungroups them.
        setHabits((prev) => prev.map((h) => (h.groupId === target.id ? { ...h, groupId: null } : h)));
        if (!isTemp(target.id)) apiDeleteHabitGroup(target.id).catch(() => invalidate());
        return;
      }

      // Deleting a parent takes its sub-habits with it, matching the FK cascade.
      removeHabitLocally(target.id);
      if (!isTemp(target.id)) apiDeleteHabit(target.id).catch(() => invalidate());
    },
    [setGroups, setHabits, removeHabitLocally, invalidate],
  );

  const handleMonthChange = useCallback((year: number, month: number) => {
    setSelected({ year, month });
  }, []);

  const handleToday = useCallback(() => {
    if (view === 'timeline') {
      setTodaySignal((signal) => signal + 1);
      return;
    }

    handleMonthChange(today.getFullYear(), today.getMonth());
  }, [handleMonthChange, today, view]);

  return (
    <div className={`habits-page relative ${view === 'timeline' ? 'max-w-none' : 'max-w-none'}`}>
      <header className="sticky-page-header w-full" style={{ width: '100%' }}>
        <div className="habits-page-header-content flex w-full items-start gap-4">
          <div className="habits-page-header-title flex-1 min-w-0">
            <h1 className="text-lg leading-6 font-semibold text-ink">Habits</h1>
            <p className="text-[13px] leading-6 text-ink-light opacity-60">{phrase}</p>
          </div>
        </div>
      </header>

      <div className="absolute top-6 right-0 z-20 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleToday}>
          Today
        </Button>

        <div className="habits-page-view-toggle inline-flex items-center rounded-[2px] border border-border h-6 overflow-hidden">
          {(
            [
              { mode: 'timeline' as const, label: 'Timeline view', Icon: DotsConnectedIcon },
              { mode: 'calendar' as const, label: 'Calendar view', Icon: Calendar },
            ]
          ).map(({ mode, label, Icon }, i) => (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`habits-page-view-toggle-button inline-flex items-center justify-center h-6 w-6 transition-colors duration-[var(--motion-fast)] ${
                i > 0 ? 'border-l border-border' : ''
              } ${view === mode ? 'bg-dot/60 text-ink' : 'bg-transparent text-ink-light hover:bg-dot/30'}`}
            >
              <Icon size={14} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </div>

      {view === 'timeline' ? (
        <HabitTimeline
          sections={sections}
          today={today}
          year={selected.year}
          month={selected.month}
          onMonthChange={handleMonthChange}
          todaySignal={todaySignal}
          editing={editing}
          collapsed={collapsedHabitIds}
          activeDragId={activeDragId}
          onToggleCollapse={toggleHabitCollapsed}
          onToggleDay={handleToggleDay}
          onStartEdit={setEditing}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={handleCancelEdit}
          onAddHabit={handleAddHabit}
          onAddGroup={handleAddGroup}
          onDelete={handleDelete}
        />
      ) : (
        <HabitCalendar
          sections={sections}
          today={today}
          year={selected.year}
          month={selected.month}
          onMonthChange={handleMonthChange}
          onToggleDay={handleToggleDay}
          editing={editing}
          activeDragId={activeDragId}
          onStartEdit={setEditing}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={handleCancelEdit}
        />
      )}
    </div>
  );
}
