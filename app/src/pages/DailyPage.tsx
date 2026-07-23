import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSync } from '../hooks/useSync';
import { isEchoedMove, isStructuralMove } from '../utils/moveEcho';
import { TaskList } from '../components/TaskList';
import { TaskVisibilityControls } from '../components/TaskVisibilityControls';
import { CollectionChip } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import type { Task } from '../components/TaskItem';
import { extractNaturalDate } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { applyIndent, getParentCandidate } from '../utils/taskTree';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { getPhrase } from '../utils/phrases';
import {
  fetchTodayTasks,
  fetchCollections,
  fetchPreferences,
  apiToggleTask,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
  type ApiTask,
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
    sectionId: t.sectionId,
    parentTaskId: t.parentTaskId ?? undefined,
    dueDate: t.dueDate ? t.dueDate.slice(0, 10) : undefined,
    type: t.type,
    createdAt: t.createdAt,
  };
}

function buildSections(overdueTasks: Task[], todayTasks: Task[]): DaySection[] {
  const byDate = new Map<string, Task[]>();

  // Tolerate a missing list rather than throwing. This renders the whole page,
  // so a bad argument here unmounts DailyPage and leaves a blank screen with no
  // way back - too harsh a failure for one caller's mistake.
  const all = [...(overdueTasks ?? []), ...(todayTasks ?? [])];

  for (const t of all) {
    // Trim any timestamp portion before matching. Falling back to todayKey is a
    // last resort for a genuinely undated task, not something a full ISO
    // timestamp should ever trigger - that would drag unrelated rows into today.
    const date = t.dueDate?.slice(0, 10);
    const key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey;
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
  const qc = useQueryClient();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const loadRequestId = useRef(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const replaceTodayFromApi = useCallback(() => {
    const requestId = ++loadRequestId.current;
    fetchTodayTasks().then((response) => {
      if (requestId !== loadRequestId.current) return;
      const overdueTasks = (response.overdue || []).map(apiToTask);
      const todayTasks = (response.today || []).map(apiToTask);
      setSections(buildSections(overdueTasks, todayTasks));
    }).catch(() => {
      if (requestId !== loadRequestId.current) return;
      setSections(buildSections([], []));
    });
  }, []);

  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  const {
    isPending: visibilityPreferencesPending,
    setHideCompletedTasks,
    setHideOldNotes,
  } = useTaskVisibilityPreferences(prefs, replaceTodayFromApi);

  useEffect(() => {
    replaceTodayFromApi();
  }, [replaceTodayFromApi]);

  useSync(useCallback((event) => {
    if (event.entityType !== 'task') return;
    // Our own move, still reconciling: the optimistic state is already ahead.
    if (isEchoedMove(event)) return;
    // Another session moved a subtree. Its date, collection, depth and every
    // sibling's order may have changed at once, so patching the one row named by
    // the event would leave it in the section it just left. Refetch instead.
    if (isStructuralMove(event) || prefs?.hideCompletedTasks || prefs?.hideOldNotes) {
      replaceTodayFromApi();
      return;
    }
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
  }, [replaceTodayFromApi, prefs?.hideCompletedTasks, prefs?.hideOldNotes]));

  const updateSections = useCallback((updater: (prev: DaySection[]) => DaySection[]) => {
    setSections(updater);
  }, []);

  // Drag handling is lifted above the individual TaskLists so a task can move
  // between rendered dates. The sections are a presentation of one flat list, so
  // the hook works on that list and the sections are rebuilt from the result -
  // which also drops an overdue section once its last task leaves, while
  // buildSections keeps Today rendered even when empty.
  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections]);
  const setAllTasks = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      setSections((prev) => buildSections([], updater(prev.flatMap((s) => s.tasks))));
    },
    [],
  );

  const { activeDragId } = useTaskDrag({
    tasks: allTasks,
    setTasks: setAllTasks,
    scope: { kind: 'day', dueDate: todayKey },
    onError: () => {
      fetchTodayTasks().then((response) => {
        setSections(
          buildSections((response.overdue || []).map(apiToTask), (response.today || []).map(apiToTask)),
        );
      });
    },
    // Daily spans every collection, so a move here can reorder a list Inbox or a
    // Collection page is caching.
    onMoved: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  // Daily spans collections, so each row states which one it belongs to.
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const renderBadge = useCallback(
    (task: Task) => {
      const collection = collections.find((c) => c.id === task.collectionId);
      if (!collection || collection.isInbox) return null;
      return <CollectionChip name={collection.name} color={collection.color} />;
    },
    [collections],
  );

  const handleToggle = useCallback((id: string) => {
    const prevSections = sectionsRef.current;
    const task = prevSections.flatMap((s) => s.tasks).find((t) => t.id === id);
    const wasCompleted = task?.isCompleted ?? false;
    const hideCompleted = prefs?.hideCompletedTasks ?? false;
    const removeOnComplete = hideCompleted && !wasCompleted;

    updateSections((prev) =>
      removeOnComplete
        ? prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
        : prev.map((s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
            ),
          }))
    );

    if (!id.startsWith('temp-')) {
      apiToggleTask(id, !wasCompleted).catch(() => {
        setSections(prevSections);
        replaceTodayFromApi();
      });
    }
  }, [prefs?.hideCompletedTasks, updateSections, replaceTodayFromApi]);

  const handleToday = useCallback(() => {
    todaySectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
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
      const extracted = extractNaturalDate(trimmed, todayKey);
      
      apiCreateTask({ 
        title: extracted.title, 
        priority: 4, 
        dueDate: extracted.dueDate, 
        type: currentType, 
        parentTaskId, 
        depth: currentIndent,
        recurrenceRule: extracted.recurrenceRule
      }).then((created) => {
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
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => replaceTodayFromApi());
  }, [replaceTodayFromApi, updateSections]);

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
                orderValue: nextOrderValue(s.tasks),
                type: 'task',
              },
            ],
          }
          : s
      )
    );
    const extracted = extractNaturalDate(trimmed, todayKey);

    apiCreateTask({ 
      title: extracted.title, 
      priority: 4, 
      dueDate: extracted.dueDate, 
      type: 'task',
      recurrenceRule: extracted.recurrenceRule
    }).then((created) => {
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
                orderValue: nextOrderValue(s.tasks),
                type: 'note',
              },
            ],
          }
          : s
      );
    });

    setEditingId(tid);
  };

  return (
    <div
      className="daily-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <header className="page-header-copy sticky-page-header max-w-162">
        <h1 className="m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink">
          Daily
        </h1>
        <p className="page-header-subtitle daily-page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
          {phrase}
        </p>
      </header>

      <div className="page-header-toolbar daily-page-header-controls sticky top-6 z-20 -mt-6 ml-auto flex w-fit items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleToday}>
          Today
        </Button>
        <TaskVisibilityControls
          hideCompletedTasks={prefs?.hideCompletedTasks ?? false}
          hideOldNotes={prefs?.hideOldNotes ?? false}
          disabled={!prefs || visibilityPreferencesPending}
          onHideCompletedTasksChange={setHideCompletedTasks}
          onHideOldNotesChange={setHideOldNotes}
        />
      </div>

      <div className="max-w-162">
        {sections.map((section) => {
          const isToday = section.key === todayKey;
          const dimNotes = section.key < todayKey;
          return (
            <div
              key={section.key}
              ref={isToday ? todaySectionRef : undefined}
              data-day-date={section.key}
              className={`mt-6 ${isToday ? 'scroll-mt-24' : ''}`}
            >
            <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light leading-6 h-6 m-0 font-medium">
              {section.label}
            </div>

            <TaskList
              tasks={section.tasks}
              containerId={`day:${section.key}`}
              dayDate={section.key}
              activeDragId={activeDragId}
              renderBadge={renderBadge}
              editingId={editingId}
              dimNotes={dimNotes}
              hideDueDate
              onTaskToggle={handleToggle}
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
    </div>
  );
}
