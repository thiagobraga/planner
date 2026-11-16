import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiCreateTask, apiDeleteTask, apiToggleTask, apiUpdateTask } from '../api/client';
import type { Preferences } from '../types/api';
import type { DaySection } from '../types/daily';
import type { Task, TaskSchedule } from '../types/task';
import type { TaskIndentHandler } from '../types/taskIndent';
import { extractNaturalDate } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { getParentCandidate } from '../utils/taskTree';
import { resolveTaskIndent } from '../utils/taskIndent';
import { persistTaskIndent } from '../utils/persistTaskIndent';
import { applySchedule, withTimeZones } from '../utils/taskTime';
import { apiToTask, dateFromISO, dayLabel } from '../utils/dailySections';
import { blurOnEscape } from '../utils/editableText';

let tempCounter = 0;
function tempId() {
  return `temp-daily-${++tempCounter}`;
}

function calculateMidpointOrder(tasks: Task[], index: number, type: 'above' | 'below') {
  const current = tasks[index].orderValue;
  if (type === 'below') {
    const next = index < tasks.length - 1 ? tasks[index + 1].orderValue : current + 2000;
    return Math.floor((current + next) / 2);
  }
  const prev = index > 0 ? tasks[index - 1].orderValue : current - 2000;
  return Math.floor((prev + current) / 2);
}

export function useDailyTaskActions(opts: {
  locale: 'en' | 'pt-BR';
  todayKey: string;
  dateFormat: string;
  prefs: Preferences | undefined;
  sections: DaySection[];
  setSections: Dispatch<SetStateAction<DaySection[]>>;
  setAllTasks: (updater: (prev: Task[]) => Task[]) => void;
  refreshDaily: () => void;
}) {
  const { locale, todayKey, dateFormat, prefs, sections, setSections, setAllTasks, refreshDaily } = opts;
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string>();
  const [, setSelectedId] = useState<string>();
  const [indentError, setIndentError] = useState(false);
  const [input, setInput] = useState('');
  const [futureInputs, setFutureInputs] = useState<Record<string, string>>({});

  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const updateSections = useCallback(
    (updater: (prev: DaySection[]) => DaySection[]) => {
      setSections(updater);
    },
    [setSections],
  );

  const handleToggle = useCallback(
    (id: string) => {
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
              tasks: s.tasks.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
            })),
      );

      if (!id.startsWith('temp-')) {
        apiToggleTask(id, !wasCompleted).catch(() => {
          setSections(prevSections);
          refreshDaily();
        });
      }
    },
    [prefs?.hideCompletedTasks, refreshDaily, setSections, updateSections],
  );

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleEditCommit = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      const currentTask = sectionsRef.current.flatMap((s) => s.tasks).find((t) => t.id === id);
      const currentType = currentTask?.type ?? 'task';
      const currentIndent = currentTask?.indent ?? 0;
      setEditingId(undefined);
      if (!trimmed) {
        updateSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
        if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
        return;
      }

      updateSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
        })),
      );

      if (id.startsWith('temp-')) {
        const section = sectionsRef.current.find((s) => s.tasks.some((t) => t.id === id));
        let parentTaskId: string | undefined;
        if (currentIndent > 0 && section) {
          const idx = section.tasks.findIndex((t) => t.id === id);
          parentTaskId = getParentCandidate(section.tasks, idx, currentIndent) ?? undefined;
        }
        // A row belongs to the day it was written under, so that day - not today -
        // is what a title without any date phrase falls back to.
        const extracted = extractNaturalDate(trimmed, section?.key ?? todayKey, locale);

        apiCreateTask({
          title: extracted.title,
          priority: 4,
          dueDate: extracted.dueDate,
          type: currentType,
          parentTaskId,
          depth: currentIndent,
          recurrenceRule: extracted.recurrenceRule,
          orderValue: currentTask?.orderValue ?? 0,
        })
          .then((created) => {
            const createdTask = apiToTask(created);
            updateSections((prev) =>
              prev.map((s) => ({
                ...s,
                tasks: s.tasks
                  .filter((t) => t.id !== createdTask.id || t.id === id)
                  .map((t) => (t.id === id ? createdTask : t)),
              })),
            );
          })
          .catch(() => {
            updateSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
          });
      } else {
        apiUpdateTask(id, { title: trimmed }).catch(() => refreshDaily());
      }
    },
    [locale, refreshDaily, todayKey, updateSections],
  );

  const handleEditCancel = useCallback(
    (id: string) => {
      setEditingId(undefined);
      if (id.startsWith('temp-')) {
        updateSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
      }
    },
    [updateSections],
  );

  const handleSetSchedule = useCallback(
    (id: string, schedule: TaskSchedule) => {
      setAllTasks((prev) => prev.map((task) => (task.id === id ? applySchedule(task, schedule) : task)));
      apiUpdateTask(id, withTimeZones(schedule))
        .then((updated) =>
          setAllTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...apiToTask(updated) } : task))),
        )
        .catch(() => refreshDaily());
    },
    [refreshDaily, setAllTasks],
  );

  const handleDelete = useCallback(
    (id: string) => {
      updateSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
      setEditingId(undefined);
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
    },
    [refreshDaily, updateSections],
  );

  const handleAddBelow = useCallback(
    (afterId: string) => {
      const tid = tempId();
      updateSections((prev) =>
        prev.map((s) => {
          const idx = s.tasks.findIndex((t) => t.id === afterId);
          if (idx === -1) return s;
          const computedOrderValue = calculateMidpointOrder(s.tasks, idx, 'below');
          const next = [...s.tasks];
          next.splice(idx + 1, 0, {
            id: tid,
            title: '',
            priority: 4,
            isCompleted: false,
            orderValue: computedOrderValue,
            indent: s.tasks[idx]?.indent,
            type: 'task',
          });
          return { ...s, tasks: next };
        }),
      );
      setEditingId(tid);
      setSelectedId(tid);
    },
    [updateSections],
  );

  const handleAddAbove = useCallback(
    (beforeId: string) => {
      const tid = tempId();
      updateSections((prev) =>
        prev.map((s) => {
          const idx = s.tasks.findIndex((t) => t.id === beforeId);
          if (idx === -1) return s;
          const computedOrderValue = calculateMidpointOrder(s.tasks, idx, 'above');
          const next = [...s.tasks];
          next.splice(idx, 0, {
            id: tid,
            title: '',
            priority: 4,
            isCompleted: false,
            orderValue: computedOrderValue,
            indent: s.tasks[idx]?.indent,
            type: 'task',
          });
          return { ...s, tasks: next };
        }),
      );
      setEditingId(tid);
      setSelectedId(tid);
    },
    [updateSections],
  );

  const handleConvertType = useCallback(
    (id: string, type: 'task' | 'note' | 'event') => {
      updateSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, type } : t)),
        })),
      );
      if (!id.startsWith('temp-')) {
        apiUpdateTask(id, { type }).catch(() => refreshDaily());
      }
    },
    [refreshDaily, updateSections],
  );

  const handleIndent: TaskIndentHandler = useCallback(
    (id, dir, visibleTasks, scope) => {
      const move = resolveTaskIndent(visibleTasks, id, dir, scope);
      if (!move) return;
      setIndentError(false);
      persistTaskIndent(
        id,
        move,
        sectionsRef.current.flatMap((section) => section.tasks),
        setAllTasks,
        refreshDaily,
        () => {
          setIndentError(true);
          refreshDaily();
        },
      );
    },
    [refreshDaily, setAllTasks],
  );

  const handleAddToday = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tid = tempId();
      setInput('');

      const todaySection = sectionsRef.current.find((s) => s.key === todayKey);
      const newOrderValue = nextOrderValue(todaySection ? todaySection.tasks : []);

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
                    orderValue: newOrderValue,
                    type: 'task',
                  },
                ],
              }
            : s,
        ),
      );
      const extracted = extractNaturalDate(trimmed, todayKey, locale);

      apiCreateTask({
        title: extracted.title,
        priority: 4,
        dueDate: extracted.dueDate,
        type: 'task',
        recurrenceRule: extracted.recurrenceRule,
        orderValue: newOrderValue,
      })
        .then((created) => {
          const createdTask = apiToTask(created);
          updateSections((prev) =>
            prev.map((s) => ({
              ...s,
              tasks: s.tasks
                .filter((t) => t.id !== createdTask.id || t.id === tid)
                .map((t) => (t.id === tid ? createdTask : t)),
            })),
          );
        })
        .catch(() => {
          // keep local version - it's in localStorage
        });
    },
    [locale, todayKey, updateSections],
  );

  const handleBoardCreate = useCallback(
    async (title: string, dueDate?: string) => {
      const created = apiToTask(await apiCreateTask({ title, dueDate, priority: 4, type: 'task' }));
      // An older board response must not replace the card we just saved.
      await qc.cancelQueries({ queryKey: ['daily'] });
      setAllTasks((tasks) => [...tasks.filter((task) => task.id !== created.id), created]);
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
    [qc, setAllTasks],
  );

  const handleAddFuture = useCallback(
    (dateKey: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tid = tempId();
      setFutureInputs((prev) => ({ ...prev, [dateKey]: '' }));

      const section = sectionsRef.current.find((s) => s.key === dateKey);
      const newOrderValue = nextOrderValue(section ? section.tasks : []);

      const row: Task = {
        id: tid,
        title: trimmed,
        priority: 4,
        isCompleted: false,
        orderValue: newOrderValue,
        type: 'task',
      };
      updateSections((prev) =>
        prev.some((s) => s.key === dateKey)
          ? prev.map((s) => (s.key === dateKey ? { ...s, tasks: [...s.tasks, row] } : s))
          : [...prev, { key: dateKey, label: dayLabel(dateFromISO(dateKey), locale, dateFormat), tasks: [row] }],
      );

      apiCreateTask({
        title: trimmed,
        priority: 4,
        dueDate: dateKey,
        type: 'task',
        orderValue: newOrderValue,
      })
        .then((created) => {
          const createdTask = apiToTask(created);
          updateSections((prev) =>
            prev.map((s) => ({
              ...s,
              tasks: s.tasks.map((t) => (t.id === tid ? createdTask : t)),
            })),
          );
        })
        .catch(() => {
          // keep local version - it's in localStorage
        });
    },
    [dateFormat, locale, updateSections],
  );

  const handleAddTodayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      blurOnEscape(e);
      if (e.key !== '-' || input !== '') {
        return;
      }

      e.preventDefault();
      const tid = tempId();

      updateSections((prev) => {
        const withToday = prev.some((s) => s.key === todayKey)
          ? prev
          : [
              ...prev,
              {
                key: todayKey,
                label: dayLabel(dateFromISO(todayKey), locale, prefsRef.current?.dateFormat),
                tasks: [],
              },
            ];

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
            : s,
        );
      });

      setEditingId(tid);
    },
    [input, locale, todayKey, updateSections],
  );

  return {
    editingId,
    setSelectedId,
    indentError,
    setIndentError,
    input,
    setInput,
    futureInputs,
    setFutureInputs,
    handleToggle,
    handleStartEdit,
    handleEditCommit,
    handleEditCancel,
    handleSetSchedule,
    handleDelete,
    handleAddBelow,
    handleAddAbove,
    handleConvertType,
    handleIndent,
    handleAddToday,
    handleBoardCreate,
    handleAddFuture,
    handleAddTodayKeyDown,
  };
}
