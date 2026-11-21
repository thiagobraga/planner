import { useCallback } from 'react';
import { apiCreateTask, apiDeleteTask, apiToggleTask, apiUpdateTask } from '../api/client';
import type { ApiTask } from '../types/api';
import type { Task, TaskSchedule } from '../types/task';
import type { TaskIndentHandler } from '../types/taskIndent';
import { extractNaturalDate } from '../utils/date';
import { resolveTaskIndent } from '../utils/taskIndent';
import { persistTaskIndent } from '../utils/persistTaskIndent';
import { applySchedule, scheduleFieldsFromApi, withTimeZones } from '../utils/taskTime';
import type { InboxTaskRowsOptions } from '../types/inbox';
import { confirmTaskDelete, holdsWork } from '../utils/deleteGuard';
import { useI18n } from '../i18n/I18nContext';

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
    createdAt: t.createdAt };
}

let tempCounter = 0;
export function tempId() { return `temp-${++tempCounter}`; }

/** Row-level task actions for the Inbox list: add above/below, rename, convert, schedule, delete, indent, toggle. */
export function useInboxTaskRows({
  tasks, tasksRef, setTasks, setEditingId, setSelectedId, setIndentError, invalidate, locale, hideCompletedTasks, includeCompleted }: InboxTaskRowsOptions) {
  const { t } = useI18n();
  const calculateMidpointOrder = (taskList: Task[], index: number, type: 'above' | 'below') => {
    const current = taskList[index].orderValue;
    if (type === 'below') {
      const next = index < taskList.length - 1 ? taskList[index + 1].orderValue : current + 2000;
      return Math.floor((current + next) / 2);
    } else {
      const prev = index > 0 ? taskList[index - 1].orderValue : current - 2000;
      return Math.floor((prev + current) / 2);
    }
  };

  const handleAddBelow = useCallback((afterId: string) => {
    const tid = tempId();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === afterId);
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
        type: 'task' });
      return next;
    });
    setEditingId(tid);
    setSelectedId(tid);
  }, [setEditingId, setSelectedId, setTasks]);

  const handleAddAbove = useCallback((beforeId: string) => {
    const tid = tempId();
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === beforeId);
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
        type: 'task' });
      return next;
    });
    setEditingId(tid);
    setSelectedId(tid);
  }, [setEditingId, setSelectedId, setTasks]);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, [setEditingId]);

  const handleEditCommit = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    setEditingId(undefined);
    if (!trimmed) {
      // Clearing a title never takes subtasks or notes with it; the rename is dropped instead.
      if (holdsWork(tasksRef.current.find((t) => t.id === id), tasksRef.current)) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => invalidate());
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    if (id.startsWith('temp-')) {
      const currentTask = tasks.find((t) => t.id === id);
      const parentTaskId = currentTask?.parentTaskId ?? undefined;
      const currentIndent = currentTask?.indent ?? 0;

      const extracted = extractNaturalDate(trimmed, undefined, locale);

      // was a new row - create it, keeping whichever type it was opened as
      apiCreateTask({
        title: extracted.title,
        priority: 4,
        sectionId: currentTask?.sectionId,
        parentTaskId,
        depth: currentIndent,
        type: currentTask?.type ?? 'task',
        dueDate: extracted.dueDate,
        recurrenceRule: extracted.recurrenceRule,
        orderValue: currentTask?.orderValue ?? 0 })
        .then((created) => {
          setTasks((prev) => prev.map((t) => (t.id === id ? { ...apiToTask(created), orderValue: t.orderValue } : t)));
        })
        .catch(() => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
        });
    } else {
      apiUpdateTask(id, { title: trimmed }).catch(() => invalidate());
    }
  }, [tasks, invalidate, locale, setEditingId, setTasks, tasksRef]);

  const handleConvertType = useCallback((taskId: string, type: 'task' | 'note' | 'event') => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, type } : t)));
    if (!taskId.startsWith('temp-')) {
      apiUpdateTask(taskId, { type }).catch(() => invalidate());
    }
  }, [invalidate, setTasks]);

  const handleEditCancel = useCallback((id: string) => {
    setEditingId(undefined);
    if (id.startsWith('temp-')) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }, [setEditingId, setTasks]);

  const handleSetSchedule = useCallback((id: string, schedule: TaskSchedule) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? applySchedule(task, schedule) : task)));
    apiUpdateTask(id, withTimeZones(schedule))
      .then((updated) => setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...apiToTask(updated) } : task))))
      .catch(() => invalidate());
  }, [setTasks, invalidate]);

  const handleDelete = useCallback((id: string) => {
    if (!confirmTaskDelete(tasksRef.current.find((t) => t.id === id), tasksRef.current, t)) return;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setTimeout(() => {
        const items = document.querySelectorAll<HTMLElement>('[data-task-id]');
        const target = items[Math.max(0, idx - 1)];
        if (target) target.focus();
        else document.querySelector<HTMLElement>('.task-add-input')?.focus();
      }, 0);
      return next;
    });
    setEditingId(undefined);
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => invalidate());
  }, [invalidate, setEditingId, setTasks, t, tasksRef]);

  const handleIndent: TaskIndentHandler = useCallback((id, dir, visibleTasks, scope) => {
    const move = resolveTaskIndent(visibleTasks, id, dir, scope);
    if (!move) return;
    setIndentError(false);
    persistTaskIndent(id, move, tasksRef.current, setTasks, invalidate, () => {
      setIndentError(true);
      invalidate();
    });
  }, [invalidate, setIndentError, setTasks, tasksRef]);

  const handleToggle = useCallback((id: string) => {
    const prevTasks = tasksRef.current;
    const task = prevTasks.find((t) => t.id === id);
    const hideCompleted = hideCompletedTasks;
    const removeOnComplete = hideCompleted && !includeCompleted && task && !task.isCompleted;

    setTasks((prev) =>
      removeOnComplete
        ? prev.filter((t) => t.id !== id)
        : prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)),
    );

    if (task && !id.startsWith('temp-')) {
      apiToggleTask(id, !task.isCompleted).catch(() => {
        setTasks(prevTasks);
        invalidate();
      });
    }
  }, [invalidate, hideCompletedTasks, includeCompleted, setTasks, tasksRef]);

  return {
    handleAddBelow, handleAddAbove, handleStartEdit, handleEditCommit, handleConvertType,
    handleEditCancel, handleSetSchedule, handleDelete, handleIndent, handleToggle };
}
