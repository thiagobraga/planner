import { useCallback, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import { apiCreateTask, apiDeleteTask, apiToggleTask, apiUpdateTask } from '../api/client';
import type { ApiTask } from '../types/api';
import type { Task, TaskSchedule } from '../types/task';
import type { TaskIndentHandler } from '../types/taskIndent';
import { nextOrderValue } from '../utils/order';
import { extractNaturalDate } from '../utils/date';
import { resolveTaskIndent } from '../utils/taskIndent';
import { persistTaskIndent } from '../utils/persistTaskIndent';
import { applySchedule, scheduleFieldsFromApi, withTimeZones } from '../utils/taskTime';
import { blurOnEscape } from '../utils/editableText';

let tempCounter = 0;
function tempId() {
  return `temp-${++tempCounter}`;
}

export function apiToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    collectionId: t.collectionId,
    sectionId: t.sectionId,
    statusId: t.statusId,
    parentTaskId: t.parentTaskId ?? undefined,
    dueDate: t.dueDate ?? undefined,
    ...scheduleFieldsFromApi(t),
    isCompleted: t.isCompleted,
    orderValue: t.orderValue,
    labels: t.labels,
    indent: t.depth,
    type: t.type,
    // Siblings with equal order values fall back to creation time; without it
    // every tie resolves arbitrarily.
    createdAt: t.createdAt,
  };
}

function calculateMidpointOrder(taskList: Task[], index: number, type: 'above' | 'below') {
  const current = taskList[index].orderValue;
  if (type === 'below') {
    const next = index < taskList.length - 1 ? taskList[index + 1].orderValue : current + 2000;
    return Math.floor((current + next) / 2);
  }
  const prev = index > 0 ? taskList[index - 1].orderValue : current - 2000;
  return Math.floor((prev + current) / 2);
}

export function useCollectionTasks(opts: {
  id: string;
  locale: 'en' | 'pt-BR';
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  hideCompletedTasks: boolean;
  includeCompleted: boolean;
  invalidate: () => Promise<void>;
}) {
  const { id, locale, tasks, setTasks, hideCompletedTasks, includeCompleted, invalidate } = opts;

  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [sectionTaskInput, setSectionTaskInput] = useState<Record<string, string>>({});
  const [, setSelectedId] = useState<string>();
  const [indentError, setIndentError] = useState(false);

  const handleAddAtEnd = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tid = tempId();
      setInput('');
      const extracted = extractNaturalDate(trimmed, undefined, locale);

      setTasks((prev) => [
        ...prev,
        { id: tid, title: extracted.title, priority: 4, isCompleted: false, orderValue: nextOrderValue(prev), type: 'task' },
      ]);
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        collectionId: id,
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
      })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== tid));
          invalidate();
        });
    },
    [id, invalidate, locale, setTasks],
  );

  const handleAddSectionTask = useCallback(
    (sectionId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tid = tempId();
      setSectionTaskInput((prev) => ({ ...prev, [sectionId]: '' }));
      const extracted = extractNaturalDate(trimmed, undefined, locale);

      setTasks((prev) => [
        ...prev,
        { id: tid, title: extracted.title, priority: 4, isCompleted: false, orderValue: nextOrderValue(prev), type: 'task', sectionId },
      ]);
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        collectionId: id,
        sectionId,
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
      })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === tid ? apiToTask(created) : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== tid));
          invalidate();
        });
    },
    [id, invalidate, locale, setTasks],
  );

  /** A leading '-' opens a note instead of a task, as it does on Daily. */
  const handleAddNoteKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): boolean => {
      blurOnEscape(e);
      if (e.key !== '-' || input !== '') return false;
      e.preventDefault();

      const tid = tempId();
      setTasks((prev) => [
        ...prev,
        {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: nextOrderValue(prev),
          type: 'note',
        },
      ]);
      setEditingId(tid);
      return true;
    },
    [input, setTasks],
  );

  const handleAddBelow = useCallback(
    (afterId: string) => {
      const tid = tempId();
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === afterId);
        if (idx === -1) return prev;
        const computedOrderValue = calculateMidpointOrder(prev, idx, 'below');
        const next = [...prev];
        next.splice(idx + 1, 0, {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: computedOrderValue,
          indent: prev[idx]?.indent,
          parentTaskId: prev[idx]?.parentTaskId,
          sectionId: prev[idx]?.sectionId,
          type: 'task',
        });
        return next;
      });
      setEditingId(tid);
      setSelectedId(tid);
    },
    [setTasks],
  );

  const handleAddAbove = useCallback(
    (beforeId: string) => {
      const tid = tempId();
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === beforeId);
        if (idx === -1) return prev;
        const computedOrderValue = calculateMidpointOrder(prev, idx, 'above');
        const next = [...prev];
        next.splice(idx, 0, {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: computedOrderValue,
          indent: prev[idx]?.indent,
          parentTaskId: prev[idx]?.parentTaskId,
          sectionId: prev[idx]?.sectionId,
          type: 'task',
        });
        return next;
      });
      setEditingId(tid);
      setSelectedId(tid);
    },
    [setTasks],
  );

  const handleStartEdit = useCallback((taskId: string) => {
    setEditingId(taskId);
  }, []);

  const handleEditCommit = useCallback(
    (taskId: string, title: string) => {
      const trimmed = title.trim();
      setEditingId(undefined);
      if (!trimmed) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (!taskId.startsWith('temp-')) apiDeleteTask(taskId).catch(() => invalidate());
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)));
      if (taskId.startsWith('temp-')) {
        const currentTask = tasks.find((t) => t.id === taskId);
        const parentTaskId = currentTask?.parentTaskId ?? undefined;
        const currentIndent = currentTask?.indent ?? 0;

        const extracted = extractNaturalDate(trimmed, undefined, locale);

        // was a new row - create it, keeping whichever type it was opened as
        apiCreateTask({
          title: extracted.title,
          priority: 4,
          collectionId: id,
          sectionId: currentTask?.sectionId,
          parentTaskId,
          depth: currentIndent,
          type: currentTask?.type ?? 'task',
          dueDate: extracted.dueDate,
          recurrenceRule: extracted.recurrenceRule,
          orderValue: currentTask?.orderValue ?? 0,
        })
          .then((created) => {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...apiToTask(created), orderValue: t.orderValue } : t)));
          })
          .catch(() => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
          });
      } else {
        apiUpdateTask(taskId, { title: trimmed }).catch(() => invalidate());
      }
    },
    [id, invalidate, locale, setTasks, tasks],
  );

  const handleConvertType = useCallback(
    (taskId: string, type: 'task' | 'note' | 'event') => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, type } : t)));
      if (!taskId.startsWith('temp-')) {
        apiUpdateTask(taskId, { type }).catch(() => invalidate());
      }
    },
    [invalidate, setTasks],
  );

  const handleEditCancel = useCallback(
    (taskId: string) => {
      setEditingId(undefined);
      if (taskId.startsWith('temp-')) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    },
    [setTasks],
  );

  const handleSetSchedule = useCallback(
    (taskId: string, schedule: TaskSchedule) => {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? applySchedule(task, schedule) : task)));
      apiUpdateTask(taskId, withTimeZones(schedule))
        .then((updated) => setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...apiToTask(updated) } : task))))
        .catch(() => invalidate());
    },
    [invalidate, setTasks],
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === taskId);
        const next = prev.filter((t) => t.id !== taskId);
        setTimeout(() => {
          const items = document.querySelectorAll<HTMLElement>('[data-task-id]');
          const target = items[Math.max(0, idx - 1)];
          if (target) target.focus();
          else document.querySelector<HTMLElement>('.task-add-input')?.focus();
        }, 0);
        return next;
      });
      setEditingId(undefined);
      if (!taskId.startsWith('temp-')) apiDeleteTask(taskId).catch(() => invalidate());
    },
    [invalidate, setTasks],
  );

  const handleIndent: TaskIndentHandler = useCallback(
    (taskId, dir, visibleTasks, scope) => {
      const move = resolveTaskIndent(visibleTasks, taskId, dir, scope);
      if (!move) return;
      setIndentError(false);
      persistTaskIndent(taskId, move, tasks, setTasks, invalidate, () => {
        setIndentError(true);
        invalidate();
      });
    },
    [invalidate, setTasks, tasks],
  );

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const removeOnComplete = hideCompletedTasks && !includeCompleted && task && !task.isCompleted;
      const previousTasks = tasks;

      setTasks((prev) =>
        removeOnComplete
          ? prev.filter((t) => t.id !== taskId)
          : prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)),
      );
      if (!taskId.startsWith('temp-') && task) {
        apiToggleTask(taskId, !task.isCompleted).catch(() => {
          setTasks(previousTasks);
          invalidate();
        });
      }
    },
    [hideCompletedTasks, includeCompleted, invalidate, setTasks, tasks],
  );

  return {
    input,
    setInput,
    editingId,
    sectionTaskInput,
    setSectionTaskInput,
    setSelectedId,
    indentError,
    setIndentError,
    handleAddAtEnd,
    handleAddSectionTask,
    handleAddNoteKeyDown,
    handleAddBelow,
    handleAddAbove,
    handleStartEdit,
    handleEditCommit,
    handleConvertType,
    handleEditCancel,
    handleSetSchedule,
    handleDelete,
    handleIndent,
    handleToggle,
  };
}
