import {
  useCallback,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiCreateTask } from '../api/client';
import type { Preferences } from '../types/api';
import type { DaySection } from '../types/daily';
import type { Task } from '../types/task';
import { extractNaturalDate } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { apiToTask } from '../utils/dailySections';
import { blurOnEscape } from '../utils/editableText';
import {
  appendFutureRow,
  appendTodayNoteRow,
  appendTodayRow,
  insertAdjacentDailyRow,
  nextDailyTempId,
  replaceTempRowWithCreated,
} from '../utils/dailyTaskMutations';

export function useDailyTaskCreate(opts: {
  locale: 'en' | 'pt-BR';
  todayKey: string;
  dateFormat: string;
  sectionsRef: RefObject<DaySection[]>;
  prefsRef: RefObject<Preferences | undefined>;
  updateSections: (updater: (prev: DaySection[]) => DaySection[]) => void;
  setAllTasks: (updater: (prev: Task[]) => Task[]) => void;
  setEditingId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedId: Dispatch<SetStateAction<string | undefined>>;
}) {
  const {
    locale,
    todayKey,
    dateFormat,
    sectionsRef,
    prefsRef,
    updateSections,
    setAllTasks,
    setEditingId,
    setSelectedId,
  } = opts;
  const qc = useQueryClient();

  const [input, setInput] = useState('');
  const [futureInputs, setFutureInputs] = useState<Record<string, string>>({});

  const handleAddBelow = useCallback(
    (afterId: string) => {
      const tid = nextDailyTempId();
      updateSections((prev) => insertAdjacentDailyRow(prev, afterId, 'below', tid));
      setEditingId(tid);
      setSelectedId(tid);
    },
    [setEditingId, setSelectedId, updateSections],
  );

  const handleAddAbove = useCallback(
    (beforeId: string) => {
      const tid = nextDailyTempId();
      updateSections((prev) => insertAdjacentDailyRow(prev, beforeId, 'above', tid));
      setEditingId(tid);
      setSelectedId(tid);
    },
    [setEditingId, setSelectedId, updateSections],
  );

  const handleAddToday = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const tid = nextDailyTempId();
      setInput('');

      const todaySection = sectionsRef.current.find((s) => s.key === todayKey);
      const newOrderValue = nextOrderValue(todaySection ? todaySection.tasks : []);

      updateSections((prev) => appendTodayRow(prev, todayKey, tid, trimmed, newOrderValue));
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
          updateSections((prev) => replaceTempRowWithCreated(prev, tid, createdTask));
        })
        .catch(() => {
          // keep local version - it's in localStorage
        });
    },
    [locale, sectionsRef, todayKey, updateSections],
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
      const tid = nextDailyTempId();
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
      updateSections((prev) => appendFutureRow(prev, dateKey, row, locale, dateFormat));

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
    [dateFormat, locale, sectionsRef, updateSections],
  );

  const handleAddTodayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      blurOnEscape(e);
      if (e.key !== '-' || input !== '') {
        return;
      }

      e.preventDefault();
      const tid = nextDailyTempId();
      updateSections((prev) =>
        appendTodayNoteRow(prev, todayKey, tid, locale, prefsRef.current?.dateFormat),
      );
      setEditingId(tid);
    },
    [input, locale, prefsRef, setEditingId, todayKey, updateSections],
  );

  return {
    input,
    setInput,
    futureInputs,
    setFutureInputs,
    handleAddBelow,
    handleAddAbove,
    handleAddToday,
    handleBoardCreate,
    handleAddFuture,
    handleAddTodayKeyDown,
  };
}
