import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useSync } from '../hooks/useSync';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';
import { getPhrase } from '../utils/phrases';
import { applyIndent, getParentCandidate } from '../utils/taskTree';
import {
  buildHabitTree,
  dayState,
  habitsToToggle,
  parentToggleTarget,
  type HabitNode,
} from '../utils/habitTree';
import {
  apiCreateTask,
  apiToggleTask,
  apiUpdateTask,
  apiDeleteTask,
  fetchTodayTasks,
  fetchHabits,
  apiToggleHabitCompletion,
  type ApiTask,
  type ApiHabit,
} from '../api/client';

interface DaySection {
  key: string;
  label: string;
  tasks: Task[];
}

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(d: Date): string {
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${month} ${day} ${weekday}`;
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const todayKey = dateKey(new Date());

function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    indent: t.depth ?? 0,
    collectionId: t.collectionId,
    dueDate: t.dueDate ? t.dueDate.slice(0, 10) : undefined,
    type: t.type,
    createdAt: t.createdAt,
  };
}

function buildSections(overdueTasks: Task[], todayTasks: Task[]): DaySection[] {
  const byDate = new Map<string, Task[]>();

  for (const t of [...overdueTasks, ...todayTasks]) {
    const key = t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : todayKey;
    const bucket = byDate.get(key) ?? [];
    bucket.push(t);
    byDate.set(key, bucket);
  }

  // Always include today even if empty (for the add-task form)
  if (!byDate.has(todayKey)) byDate.set(todayKey, []);

  const sortedDates = Array.from(byDate.keys()).sort().reverse();
  return sortedDates.map((date) => ({
    key: date,
    label: dayLabel(dateFromISO(date)),
    tasks: (byDate.get(date) ?? []).sort((a, b) => a.orderValue - b.orderValue || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
  }));
}

let tempCounter = 0;
function tempId() { return `temp-daily-${++tempCounter}`; }

export function DailyPage() {
  const phrase = useMemo(() => getPhrase('daily'), []);
  const [sections, setSections] = useState<DaySection[]>([]);
  const [habits, setHabits] = useState<ApiHabit[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    fetchTodayTasks().then((response) => {
      const overdueTasks = (response.overdue || []).map(apiToTask);
      const todayTasks = (response.today || []).map(apiToTask);
      setSections(buildSections(overdueTasks, todayTasks));
    }).catch(() => {
      setSections(buildSections([], []));
    });
  }, []);

  useEffect(() => {
    fetchHabits().then(setHabits).catch(() => setHabits([]));
  }, []);

  // Only leaf habits store completions, so toggling a parent fans out to its
  // sub-habits. Mirrors the habits page.
  const handleHabitToggle = useCallback((node: HabitNode) => {
    const target = parentToggleTarget(node, todayKey);
    const leaves = habitsToToggle(node, todayKey, target);
    if (leaves.length === 0) return;

    const ids = new Set(leaves.map((leaf) => leaf.id));
    setHabits((prev) =>
      prev.map((h) => {
        if (!ids.has(h.id)) return h;
        const completions = target
          ? [...h.completions, todayKey]
          : h.completions.filter((c) => c !== todayKey);
        return { ...h, completions };
      })
    );
    Promise.all(leaves.map((leaf) => apiToggleHabitCompletion(leaf.id, todayKey, target))).catch(() => {
      fetchHabits().then(setHabits).catch(() => { });
    });
  }, []);

  // Sub-habits stay on the habits page; the day view lists only top-level habits.
  const rootHabits = useMemo(() => buildHabitTree(habits), [habits]);

  const renderHabitRow = useCallback((habit: HabitNode) => {
    const state = dayState(habit, todayKey);
    const done = state === 'full';

    return (
      <div
        key={habit.id}
        className={`task-item group ${done ? 'opacity-[0.35]' : ''}`}
        aria-label={habit.name}
        role="button"
        tabIndex={0}
        onClick={() => handleHabitToggle(habit)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHabitToggle(habit);
          }
        }}
      >
        <button
          type="button"
          aria-label={done ? `Reopen: ${habit.name}` : `Complete: ${habit.name}`}
          role="checkbox"
          aria-checked={state === 'half' ? 'mixed' : done}
          onClick={(e) => {
            e.stopPropagation();
            handleHabitToggle(habit);
          }}
          className="task-item-toggle w-6 text-center overflow-hidden text-ink select-none shrink-0 cursor-pointer bg-transparent border-0 p-0"
          style={done ? {
            fontSize: 'var(--icon-check-size, 26px)',
            transform: 'translateY(var(--icon-check-offset, 0px))',
            lineHeight: 'var(--task-line-height, 24px)',
          } : {
            fontSize: 'var(--icon-dot-size, 10px)',
            transform: 'translateY(var(--icon-dot-offset, 0px))',
            lineHeight: 'var(--task-line-height, 24px)',
          }}
        >
          {done ? '×' : state === 'half' ? '◐' : '•'}
        </button>

        <span
          style={{ lineHeight: 'var(--task-line-height, 24px)' }}
          className="task-item-title-area flex-1 flex flex-wrap items-baseline min-w-0"
        >
          <span
            style={{ lineHeight: 'var(--task-line-height, 24px)' }}
            className={`task-item-title-text text-sm break-words ${done ? 'line-through text-ink-light' : 'text-ink'}`}
          >
            {habit.name}
          </span>
        </span>
      </div>
    );
  }, [handleHabitToggle]);

  const replaceTodayFromApi = useCallback(() => {
    fetchTodayTasks().then((response) => {
      const overdueTasks = (response.overdue || []).map(apiToTask);
      const todayTasks = (response.today || []).map(apiToTask);
      setSections(buildSections(overdueTasks, todayTasks));
    }).catch(() => { });
  }, []);

  useSync(useCallback((event) => {
    if (event.entityType === 'habit' || event.entityType === 'habit_completion') {
      fetchHabits().then(setHabits).catch(() => { });
      return;
    }
    if (event.entityType !== 'task') return;
    if (event.eventType === 'deleted') {
      setSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== event.entityId) }))
      );
    } else if (event.eventType === 'created' && event.payload) {
      const created = apiToTask(event.payload as ApiTask);
      setSections((prev) => {
        const alreadyPresent = prev.some((s) => s.tasks.some((t) => t.id === created.id));
        if (alreadyPresent) return prev;
        const key = created.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(created.dueDate) ? created.dueDate : todayKey;
        const existingIdx = prev.findIndex((s) => s.key === key);
        if (existingIdx === -1) {
          const next = [...prev, { key, label: dayLabel(dateFromISO(key)), tasks: [created] }];
          return next.sort((a, b) => (a.key < b.key ? 1 : -1));
        }
        return prev.map((s, i) => (i === existingIdx ? { ...s, tasks: [...s.tasks, created] } : s));
      });
    } else if (event.payload) {
      const updated = apiToTask(event.payload as ApiTask);
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === event.entityId ? updated : t)),
        }))
      );
    }
  }, []));

  const updateSections = useCallback((updater: (prev: DaySection[]) => DaySection[]) => {
    setSections(updater);
  }, []);

  const handleToggle = useCallback((id: string) => {
    const prevSections = sectionsRef.current;
    const task = prevSections.flatMap((s) => s.tasks).find((t) => t.id === id);
    const wasCompleted = task?.isCompleted ?? false;

    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
        ),
      }))
    );

    if (!id.startsWith('temp-')) {
      apiToggleTask(id, !wasCompleted).catch(() => {
        updateSections((prev) =>
          prev.map((s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, isCompleted: wasCompleted } : t
            ),
          }))
        );
      });
    }
  }, [updateSections]);

  const handleReorder = useCallback((key: string) => (reordered: Task[]) => {
    updateSections((prev) => prev.map((s) => (s.key === key ? { ...s, tasks: reordered } : s)));
  }, [updateSections]);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
    setSelectedId(id);
  }, []);

  const handleEditCommit = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    const currentTask = sectionsRef.current.flatMap((s) => s.tasks).find((t) => t.id === id);
    const currentType = currentTask?.type ?? 'task';
    const currentIndent = currentTask?.indent ?? 0;
    setEditingId(undefined);
    if (!trimmed) {
      updateSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
      );
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => replaceTodayFromApi());
      return;
    }

    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
      }))
    );

    if (id.startsWith('temp-')) {
      let parentTaskId: string | undefined;
      if (currentIndent > 0) {
        const section = sectionsRef.current.find((s) => s.tasks.some((t) => t.id === id));
        if (section) {
          const idx = section.tasks.findIndex((t) => t.id === id);
          parentTaskId = getParentCandidate(section.tasks, idx, currentIndent) ?? undefined;
        }
      }
      apiCreateTask({ title: trimmed, priority: 4, dueDate: todayKey, type: currentType, parentTaskId, depth: currentIndent }).then((created) => {
        const createdTask = apiToTask(created);
        updateSections((prev) =>
          prev.map((s) => ({
            ...s,
            tasks: s.tasks
              .filter((t) => t.id !== createdTask.id || t.id === id)
              .map((t) => (t.id === id ? createdTask : t)),
          }))
        );
      }).catch(() => {
        updateSections((prev) =>
          prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
        );
      });
    } else {
      apiUpdateTask(id, { title: trimmed }).catch(() => replaceTodayFromApi());
    }
  }, [replaceTodayFromApi, updateSections]);

  const handleEditCancel = useCallback((id: string) => {
    setEditingId(undefined);
    if (id.startsWith('temp-')) {
      updateSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
      );
    }
  }, [updateSections]);

  const handleDelete = useCallback((id: string) => {
    updateSections((prev) =>
      prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
    );
    setEditingId(undefined);
    setSelectedId(undefined);
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => replaceTodayFromApi());
  }, [replaceTodayFromApi, updateSections]);

  const handleTaskClick = useCallback((id: string) => {
    setSelectedId((prev) => prev === id ? undefined : id);
  }, []);

  const handleAddBelow = useCallback((afterId: string) => {
    const tid = tempId();
    updateSections((prev) =>
      prev.map((s) => {
        const idx = s.tasks.findIndex((t) => t.id === afterId);
        if (idx === -1) return s;
        const next = [...s.tasks];
        next.splice(idx + 1, 0, {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: 0,
          indent: s.tasks[idx]?.indent,
          type: 'task',
        });
        return { ...s, tasks: next.map((t, i) => ({ ...t, orderValue: i + 1 })) };
      })
    );
    setEditingId(tid);
    setSelectedId(tid);
  }, [updateSections]);

  const handleConvertType = useCallback((id: string, type: 'task' | 'note') => {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, type } : t)),
      }))
    );
    if (!id.startsWith('temp-')) {
      apiUpdateTask(id, { type }).catch(() => replaceTodayFromApi());
    }
  }, [replaceTodayFromApi, updateSections]);

  const handleIndent = useCallback((id: string, dir: 1 | -1) => {
    updateSections((prev) =>
      prev.map((s) => {
        if (!s.tasks.some((t) => t.id === id)) return s;
        // Cross-collection view: only nest under a same-collection preceding task.
        const { tasks: next, parentTaskId, changed } = applyIndent(s.tasks, id, dir, {
          sameCollectionOnly: true,
        });
        if (!changed) return s;
        if (!id.startsWith('temp-')) {
          apiUpdateTask(id, { parentTaskId }).catch(() => replaceTodayFromApi());
        }
        return { ...s, tasks: next };
      })
    );
  }, [replaceTodayFromApi, updateSections]);

  const handleAddToday = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const tid = tempId();
    setInput('');

    updateSections((prev) =>
      prev.map((s) =>
        s.key === todayKey
          ? {
            ...s,
            tasks: [
              ...s.tasks,
              {
                id: tid,
                title: trimmed,
                priority: 4,
                isCompleted: false,
                orderValue: s.tasks.length + 1,
                type: 'task',
              },
            ],
          }
          : s
      )
    );

    apiCreateTask({ title: trimmed, priority: 4, dueDate: todayKey, type: 'task' }).then((created) => {
      const createdTask = apiToTask(created);
      updateSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks
            .filter((t) => t.id !== createdTask.id || t.id === tid)
            .map((t) => (t.id === tid ? createdTask : t)),
        }))
      );
    }).catch(() => {
      // keep local version - it's in localStorage
    });
  };

  const handleAddTodayKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== '-' || input !== '') {
      return;
    }

    e.preventDefault();
    const tid = tempId();

    updateSections((prev) => {
      const withToday = prev.some((s) => s.key === todayKey)
        ? prev
        : [...prev, { key: todayKey, label: dayLabel(dateFromISO(todayKey)), tasks: [] }];

      return withToday.map((s) =>
        s.key === todayKey
          ? {
            ...s,
            tasks: [
              ...s.tasks,
              {
                id: tid,
                title: '',
                priority: 4,
                dueDate: todayKey,
                isCompleted: false,
                orderValue: s.tasks.length + 1,
                type: 'note',
              },
            ],
          }
          : s
      );
    });

    setEditingId(tid);
    setSelectedId(tid);
  };

  return (
    <div
      className="max-w-162 cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">
          Daily
        </h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
          {phrase}
        </p>
      </header>

      {sections.map((section) => {
        const isToday = section.key === todayKey;
        return (
          <div key={section.key} className="mt-6">
            <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light leading-6 h-6 m-0 font-medium">
              {section.label}
            </div>

            {isToday && rootHabits.map(renderHabitRow)}

            <TaskList
              tasks={section.tasks}
              selectedTaskId={selectedId}
              editingId={editingId}
              hideDueDate
              onTaskClick={handleTaskClick}
              onTaskToggle={handleToggle}
              onReorder={handleReorder(section.key)}
              onStartEdit={handleStartEdit}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
              onDelete={handleDelete}
              onAddBelow={handleAddBelow}
              onIndent={handleIndent}
              onConvertType={handleConvertType}
            />

            {isToday && (
              <form
                onSubmit={handleAddToday}
                className="flex items-center h-6"
              >
                <span className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
                  •
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleAddTodayKeyDown}
                  placeholder="Add task…"
                  className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
                  spellCheck={false}
                />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
