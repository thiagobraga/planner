import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSync } from './useSync';
import { isEchoedMove, isStructuralMove } from '../utils/moveEcho';
import { apiToTask, dateFromISO, dayLabel } from '../utils/dailySections';
import type { ApiTask, Preferences } from '../types/api';
import type { DaySection } from '../types/daily';

export function useDailySync(opts: {
  locale: 'en' | 'pt-BR';
  todayKey: string;
  prefs: Preferences | undefined;
  refreshDaily: () => void;
  setSections: Dispatch<SetStateAction<DaySection[]>>;
}) {
  const { locale, todayKey, prefs, refreshDaily, setSections } = opts;
  const qc = useQueryClient();

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    window.addEventListener('task-created', refreshDaily);
    return () => window.removeEventListener('task-created', refreshDaily);
  }, [refreshDaily]);

  useSync(
    useCallback(
      (event) => {
        if (event.entityType === 'status') {
          qc.invalidateQueries({ queryKey: ['collection'] });
          return;
        }
        if (event.entityType !== 'task') return;
        // Our own move, still reconciling: the optimistic state is already ahead.
        if (isEchoedMove(event)) return;
        // Another session moved a subtree. Its date, collection, depth and every
        // sibling's order may have changed at once, so patching the one row named by
        // the event would leave it in the section it just left. Refetch instead.
        if (isStructuralMove(event) || prefs?.hideCompletedTasks || prefs?.showNotes === false) {
          refreshDaily();
          return;
        }
        if (event.eventType === 'deleted') {
          setSections((prev) =>
            prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== event.entityId) })),
          );
        } else if (event.eventType === 'created' && event.payload) {
          const created = apiToTask(event.payload as ApiTask);
          if (!created.dueDate) return;
          const key = created.dueDate > todayKey ? todayKey : created.dueDate;
          setSections((prev) => {
            if (prev.some((s) => s.tasks.some((t) => t.id === created.id))) return prev;
            const existingIdx = prev.findIndex((s) => s.key === key);
            if (existingIdx === -1) {
              const next = [
                ...prev,
                {
                  key,
                  label: dayLabel(dateFromISO(key), locale, prefsRef.current?.dateFormat),
                  tasks: [created],
                },
              ];
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
            })),
          );
        }
      },
      [locale, qc, refreshDaily, prefs?.hideCompletedTasks, prefs?.showNotes, setSections, todayKey],
    ),
  );
}
