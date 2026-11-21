import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { apiCreateTask, apiDeleteTask, apiToggleTask, apiUpdateTask } from '../api/client';
import type { Preferences } from '../types/api';
import type { DaySection } from '../types/daily';
import type { Task, TaskSchedule } from '../types/task';
import type { TaskIndentHandler } from '../types/taskIndent';
import { extractNaturalDate } from '../utils/date';
import { getParentCandidate } from '../utils/taskTree';
import { resolveTaskIndent } from '../utils/taskIndent';
import { persistTaskIndent } from '../utils/persistTaskIndent';
import { applySchedule, withTimeZones } from '../utils/taskTime';
import { apiToTask } from '../utils/dailySections';
import { confirmTaskDelete, holdsWork } from '../utils/deleteGuard';
import { useI18n } from '../i18n/I18nContext';
import {
  patchDailyTask,
  removeDailyTask,
  replaceTempRowWithCreated,
} from '../utils/dailyTaskMutations';
import { useDailyTaskCreate } from './useDailyTaskCreate';

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
  const { t } = useI18n();

  const [editingId, setEditingId] = useState<string>();
  const [, setSelectedId] = useState<string>();
  const [indentError, setIndentError] = useState(false);

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

  const createActions = useDailyTaskCreate({
    locale,
    todayKey,
    dateFormat,
    sectionsRef,
    prefsRef,
    updateSections,
    setAllTasks,
    setEditingId,
    setSelectedId,
  });

  const handleToggle = useCallback(
    (id: string) => {
      const prevSections = sectionsRef.current;
      const task = prevSections.flatMap((s) => s.tasks).find((t) => t.id === id);
      const wasCompleted = task?.isCompleted ?? false;
      const hideCompleted = prefs?.hideCompletedTasks ?? false;
      const removeOnComplete = hideCompleted && !wasCompleted;

      updateSections((prev) =>
        removeOnComplete ? removeDailyTask(prev, id) : patchDailyTask(prev, id, { isCompleted: !wasCompleted }),
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
        // Clearing a title never takes subtasks or notes with it; the rename is dropped instead.
        if (holdsWork(currentTask, sectionsRef.current.flatMap((s) => s.tasks))) return;
        updateSections((prev) => removeDailyTask(prev, id));
        if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
        return;
      }

      updateSections((prev) => patchDailyTask(prev, id, { title: trimmed }));

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
            updateSections((prev) => replaceTempRowWithCreated(prev, id, createdTask));
          })
          .catch(() => {
            updateSections((prev) => removeDailyTask(prev, id));
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
        updateSections((prev) => removeDailyTask(prev, id));
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
      const all = sectionsRef.current.flatMap((s) => s.tasks);
      if (!confirmTaskDelete(all.find((task) => task.id === id), all, t)) return;
      updateSections((prev) => removeDailyTask(prev, id));
      setEditingId(undefined);
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
    },
    [refreshDaily, updateSections, t],
  );

  const handleConvertType = useCallback(
    (id: string, type: 'task' | 'note' | 'event') => {
      updateSections((prev) => patchDailyTask(prev, id, { type }));
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

  return {
    editingId,
    setSelectedId,
    indentError,
    setIndentError,
    ...createActions,
    handleToggle,
    handleStartEdit,
    handleEditCommit,
    handleEditCancel,
    handleSetSchedule,
    handleDelete,
    handleConvertType,
    handleIndent,
  };
}
