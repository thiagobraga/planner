import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useSync } from '../hooks/useSync';
import { TaskList } from '../components/TaskList';
import type { Task } from '../components/TaskItem';
import { getPhrase } from '../utils/phrases';
import {
  apiCreateTask,
  apiToggleTask,
  apiUpdateTask,
  apiDeleteTask,
  fetchTodayTasks,
  type ApiTask,
} from '../api/client';

interface DaySection {
  key: string;
  label: string;
  tasks: Task[];
}

const LS_KEY = 'planner_daily_v1';

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(d: Date): string {
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${month} ${day} ${weekday}`;
}

const todayKey = dateKey(new Date());
const todayLabel = dayLabel(new Date());

function mergeTasks(a: Task[], b: Task[]): Task[] {
  const merged = new Map<string, Task>();
  for (const task of [...a, ...b]) {
    merged.set(task.id, task);
  }
  return Array.from(merged.values()).sort((x, y) => x.orderValue - y.orderValue);
}

function ensureToday(sections: DaySection[]): DaySection[] {
  const today: DaySection = { key: todayKey, label: todayLabel, tasks: [] };
  const byKey = new Map<string, DaySection>();

  for (const section of sections) {
    const isTodaySection = section.key === todayKey || section.label === todayLabel;
    if (isTodaySection) {
      today.tasks = mergeTasks(today.tasks, section.tasks);
      continue;
    }

    const existing = byKey.get(section.key);
    byKey.set(
      section.key,
      existing
        ? { ...existing, tasks: mergeTasks(existing.tasks, section.tasks) }
        : section,
    );
  }

  return [today, ...Array.from(byKey.values())];
}

function loadSections(): DaySection[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return ensureToday([]);
    return ensureToday(JSON.parse(raw) as DaySection[]);
  } catch {
    return ensureToday([]);
  }
}

function saveSections(sections: DaySection[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sections));
  } catch {
    // quota exceeded — ignore
  }
}

function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    indent: t.depth ?? 0,
    dueDate: t.dueDate,
  };
}

function replaceApiTasks(section: DaySection, apiTasks: Task[]): DaySection {
  const apiIds = new Set(apiTasks.map((t) => t.id));
  const localOnlyTasks = section.tasks.filter((t) => {
    if (apiIds.has(t.id)) return false;
    return t.id.startsWith('temp-') || t.isCompleted;
  });
  return { ...section, tasks: [...apiTasks, ...localOnlyTasks] };
}

let tempCounter = 0;
function tempId() { return `temp-daily-${++tempCounter}`; }

export function TodayPage() {
  const phrase = useMemo(() => getPhrase('daily'), []);
  const [sections, setSections] = useState<DaySection[]>(loadSections);
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage whenever sections change
  useEffect(() => {
    saveSections(sections);
  }, [sections]);

  // Replace today's tasks from API on mount (localStorage shown instantly while this loads)
  useEffect(() => {
    fetchTodayTasks().then(({ today, overdue }) => {
      const overdueTasks = overdue.map(apiToTask);
      const todayTasks = today.map(apiToTask);

      // Group overdue by date
      const byDate = new Map<string, Task[]>();
      for (const t of overdueTasks) {
        if (t.dueDate) {
          const bucket = byDate.get(t.dueDate) ?? [];
          bucket.push(t);
          byDate.set(t.dueDate, bucket);
        }
      }

      // Build sections: overdue dates first, then today
      const sections: DaySection[] = [];
      for (const [date, tasks] of byDate) {
        sections.push({
          key: date,
          label: dayLabel(new Date(`${date}T00:00:00Z`)),
          tasks: tasks.sort((a, b) => a.orderValue - b.orderValue),
        });
      }

      const todaySection = {
        key: todayKey,
        label: todayLabel,
        tasks: todayTasks.sort((a, b) => a.orderValue - b.orderValue),
      };
      sections.push(todaySection);

      setSections(sections);
    }).catch(() => { /* offline — localStorage shown */ });
  }, []);

  const replaceTodayFromApi = useCallback(() => {
    fetchTodayTasks().then(({ today, overdue }) => {
      const overdueTasks = overdue.map(apiToTask);
      const todayTasks = today.map(apiToTask);

      // Group overdue by date
      const byDate = new Map<string, Task[]>();
      for (const t of overdueTasks) {
        if (t.dueDate) {
          const bucket = byDate.get(t.dueDate) ?? [];
          bucket.push(t);
          byDate.set(t.dueDate, bucket);
        }
      }

      // Build sections: overdue dates first, then today
      const sections: DaySection[] = [];
      for (const [date, tasks] of byDate) {
        sections.push({
          key: date,
          label: dayLabel(new Date(`${date}T00:00:00Z`)),
          tasks: tasks.sort((a, b) => a.orderValue - b.orderValue),
        });
      }

      const todaySection = {
        key: todayKey,
        label: todayLabel,
        tasks: todayTasks.sort((a, b) => a.orderValue - b.orderValue),
      };
      sections.push(todaySection);

      setSections(sections);
    }).catch(() => {});
  }, []);

  useSync(useCallback((event) => {
    if (event.entityType !== 'task') return;
    if (event.eventType === 'deleted') {
      setSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== event.entityId) }))
      );
    } else {
      // Remove task from all sections (it may have moved to a different day)
      // then refetch today's tasks
      setSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== event.entityId) }))
      );
      replaceTodayFromApi();
    }
  }, [replaceTodayFromApi]));

  const updateSections = useCallback((updater: (prev: DaySection[]) => DaySection[]) => {
    setSections((prev) => {
      const next = updater(prev);
      saveSections(next);
      return next;
    });
  }, []);

  const handleToggle = useCallback((id: string) => {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
        ),
      }))
    );
    const task = sections.flatMap((s) => s.tasks).find((t) => t.id === id);
    if (task && !id.startsWith('temp-')) {
      apiToggleTask(id, !task.isCompleted).catch(() => {
        // revert
        updateSections((prev) =>
          prev.map((s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, isCompleted: task.isCompleted } : t
            ),
          }))
        );
      });
    }
  }, [sections, updateSections]);

  const handleReorder = useCallback((key: string) => (reordered: Task[]) => {
    updateSections((prev) => prev.map((s) => (s.key === key ? { ...s, tasks: reordered } : s)));
  }, [updateSections]);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
    setSelectedId(id);
  }, []);

  const handleEditCommit = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
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
      apiCreateTask({ title: trimmed, priority: 4, dueDate: todayKey }).then((created) => {
        updateSections((prev) =>
          prev.map((s) => ({
            ...s,
            tasks: s.tasks.map((t) => (t.id === id ? apiToTask(created) : t)),
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
        });
        return { ...s, tasks: next.map((t, i) => ({ ...t, orderValue: i + 1 })) };
      })
    );
    setEditingId(tid);
    setSelectedId(tid);
  }, [updateSections]);

  const handleIndent = useCallback((id: string, dir: 1 | -1) => {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== id) return t;
          const indent = Math.max(0, Math.min(4, (t.indent ?? 0) + dir));
          if (!id.startsWith('temp-')) apiUpdateTask(id, { depth: indent }).catch(() => replaceTodayFromApi());
          return { ...t, indent };
        }),
      }))
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
                },
              ],
            }
          : s
      )
    );

    apiCreateTask({ title: trimmed, priority: 4, dueDate: todayKey }).then((created) => {
      updateSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === tid ? apiToTask(created) : t)),
        }))
      );
    }).catch(() => {
      // keep local version — it's in localStorage
    });
  };

  return (
    <div
      style={{ maxWidth: '648px', cursor: 'text' }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
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
        Daily
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

      {sections.map((section) => {
        const isToday = section.key === todayKey;
        return (
          <div key={section.key} style={{ marginTop: '24px' }}>
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-light)',
                lineHeight: '24px',
                height: '24px',
                margin: 0,
                fontWeight: 500,
              }}
            >
              {section.label}
            </div>

            <TaskList
              tasks={section.tasks}
              selectedTaskId={selectedId}
              editingId={editingId}
              onTaskClick={(id) => setSelectedId(id === selectedId ? undefined : id)}
              onTaskToggle={handleToggle}
              onReorder={handleReorder(section.key)}
              onStartEdit={handleStartEdit}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
              onDelete={handleDelete}
              onAddBelow={handleAddBelow}
              onIndent={handleIndent}
            />

            {isToday && (
              <form
                onSubmit={handleAddToday}
                style={{ display: 'flex', alignItems: 'center', height: '24px' }}
              >
                <span
                  style={{
                    width: '24px',
                    textAlign: 'center',
                    fontSize: '10px',
                    lineHeight: '24px',
                    color: 'var(--color-ink)',
                    opacity: 0.25,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  •
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Add task…"
                  className="task-input task-add-input"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    lineHeight: '24px',
                    fontFamily: '"Lora", serif',
                    color: 'var(--color-ink)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                  }}
                />
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
