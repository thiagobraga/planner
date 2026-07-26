import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSync } from '../hooks/useSync';
import { isEchoedMove, isStructuralMove } from '../utils/moveEcho';
import { TaskList } from '../components/TaskList';
import { TaskVisibilityControls } from '../components/TaskVisibilityControls';
import { CalendarWidget } from '../components/CalendarWidget';
import { VirtualDay } from '../components/VirtualDay';
import { CollectionChip } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import type { Task } from '../components/TaskItem';
import { addDaysToISO, dateFromISO, extractNaturalDate, fmtISOInTimeZone } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { applyIndent, getParentCandidate } from '../utils/taskTree';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useMidnightTimer } from '../hooks/useMidnightTimer';
import { useI18n } from '../i18n/I18nContext';
import { getPhrase } from '../utils/phrases';
import {
  fetchDailyTimeline,
  fetchCollections,
  fetchPreferences,
  apiToggleTask,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
  paletteColorHex,
  type ApiTask,
} from '../api/client';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';

interface DaySection {
  key: string;
  label: string;
  tasks: Task[];
}

function dayLabel(d: Date, locale: 'en' | 'pt-BR'): string {
  const month = d.toLocaleDateString(locale, { month: 'short' }).toLocaleUpperCase(locale);
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = d.toLocaleDateString(locale, { weekday: 'short' }).toLocaleUpperCase(locale);
  return `${month} ${day} ${weekday}`;
}

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

const CHUNK_DAYS = 15;

function timelineSections(
  days: Array<{ date: string; tasks: ApiTask[] }>,
  locale: 'en' | 'pt-BR',
): DaySection[] {
  return days
    .map(({ date, tasks }) => ({
      key: date,
      label: dayLabel(dateFromISO(date), locale),
      tasks: tasks.map(apiToTask),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function mergeTimelineSections(
  current: DaySection[],
  days: Array<{ date: string; tasks: ApiTask[] }>,
  locale: 'en' | 'pt-BR',
): DaySection[] {
  const byDate = new Map(current.map((section) => [section.key, section]));
  for (const section of timelineSections(days, locale)) byDate.set(section.key, section);
  return Array.from(byDate.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function rebuildSections(current: DaySection[], tasks: Task[], locale: 'en' | 'pt-BR'): DaySection[] {
  const byDate = new Map(current.map((section) => [section.key, [] as Task[]]));
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const date = task.dueDate.slice(0, 10);
    const bucket = byDate.get(date) ?? [];
    bucket.push(task);
    byDate.set(date, bucket);
  }
  return Array.from(byDate, ([key, dayTasks]) => ({
    key,
    label: dayLabel(dateFromISO(key), locale),
    tasks: dayTasks,
  })).sort((a, b) => b.key.localeCompare(a.key));
}

let tempCounter = 0;
function tempId() { return `temp-daily-${++tempCounter}`; }

export function DailyPage() {
  const { locale, t } = useI18n();
  const phrase = useMemo(() => getPhrase('daily', locale), [locale]);
  const qc = useQueryClient();
  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });
  const preferencesUserId = prefs?.userId;
  const [rolloverVersion, setRolloverVersion] = useState(0);
  const todayKey = useMemo(
    () => fmtISOInTimeZone(new Date(), prefs?.timeZone),
    [prefs?.timeZone, rolloverVersion],
  );
  const [sections, setSections] = useState<DaySection[]>([]);
  const [activeDate, setActiveDate] = useState(todayKey);
  const [timelineReady, setTimelineReady] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const futureSentinelRef = useRef<HTMLDivElement>(null);
  const pastSentinelRef = useRef<HTMLDivElement>(null);
  const loadRequestId = useRef(0);
  const pendingRanges = useRef(new Set<string>());
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const loadedStart = sections.at(-1)?.key;
  const loadedEnd = sections[0]?.key;

  const anchorPrepend = useCallback((anchorDate: string, apply: () => void) => {
    const anchor = document.getElementById(`daily-day-${anchorDate}`);
    const scroller = anchor?.closest('.app-shell-main-content');
    const beforeTop = anchor?.getBoundingClientRect().top;
    apply();
    if (!anchor || !scroller || beforeTop === undefined) return;
    requestAnimationFrame(() => {
      const after = document.getElementById(`daily-day-${anchorDate}`);
      if (after) scroller.scrollTop += after.getBoundingClientRect().top - beforeTop;
    });
  }, []);

  const replaceTimelineFromApi = useCallback(() => {
    const requestId = ++loadRequestId.current;
    const dates = sections.map((section) => section.key).sort();
    const ranges: Array<{ start: string; end: string }> = [];
    for (let index = 0; index < dates.length;) {
      const start = dates[index];
      let end = start;
      let count = 1;
      while (
        index + count < dates.length &&
        count < 31 &&
        dates[index + count] === addDaysToISO(end, 1)
      ) {
        end = dates[index + count];
        count += 1;
      }
      ranges.push({ start, end });
      index += count;
    }
    if (ranges.length === 0) {
      ranges.push({ start: addDaysToISO(todayKey, -(CHUNK_DAYS - 1)), end: todayKey });
    }

    Promise.all(ranges.map(({ start, end }) => fetchDailyTimeline(start, end)))
      .then((responses) => {
        if (requestId !== loadRequestId.current) return;
        setSections(timelineSections(responses.flatMap((response) => response.days), locale));
        setTimelineReady(true);
      })
      .catch(() => undefined);
  }, [locale, sections, todayKey]);

  const {
    isPending: visibilityPreferencesPending,
    setHideCompletedTasks,
    setHideOldNotes,
  } = useTaskVisibilityPreferences(prefs, replaceTimelineFromApi);

  useEffect(() => {
    if (!preferencesUserId) return;
    const requestId = ++loadRequestId.current;
    const initialStart = addDaysToISO(todayKey, -(CHUNK_DAYS - 1));

    fetchDailyTimeline(initialStart, todayKey)
      .then((response) => {
        if (requestId !== loadRequestId.current) return null;
        setSections(timelineSections(response.days, locale));
        setActiveDate(todayKey);
        return fetchDailyTimeline(addDaysToISO(todayKey, 1), addDaysToISO(todayKey, CHUNK_DAYS));
      })
      .then((response) => {
        if (!response || requestId !== loadRequestId.current) return;
        anchorPrepend(todayKey, () => {
          setSections((current) => mergeTimelineSections(current, response.days, locale));
        });
        setTimelineReady(true);
      })
      .catch(() => {
        if (requestId !== loadRequestId.current) return;
        setTimelineReady(true);
      });
  }, [anchorPrepend, locale, preferencesUserId, rolloverVersion, todayKey]);

  const loadRange = useCallback(async (start: string, end: string, prepend = false) => {
    const rangeKey = `${start}:${end}`;
    if (pendingRanges.current.has(rangeKey)) return;
    const requestId = loadRequestId.current;
    pendingRanges.current.add(rangeKey);
    try {
      const response = await fetchDailyTimeline(start, end);
      if (requestId !== loadRequestId.current) return;
      const apply = () => setSections((current) => mergeTimelineSections(current, response.days, locale));
      if (prepend && sectionsRef.current[0]) anchorPrepend(sectionsRef.current[0].key, apply);
      else apply();
    } finally {
      pendingRanges.current.delete(rangeKey);
    }
  }, [anchorPrepend, locale]);

  const loadFuture = useCallback(() => {
    const currentEnd = sectionsRef.current[0]?.key;
    if (!currentEnd) return;
    void loadRange(addDaysToISO(currentEnd, 1), addDaysToISO(currentEnd, CHUNK_DAYS), true);
  }, [loadRange]);

  const loadPast = useCallback(() => {
    const currentStart = sectionsRef.current.at(-1)?.key;
    if (!currentStart) return;
    void loadRange(addDaysToISO(currentStart, -CHUNK_DAYS), addDaysToISO(currentStart, -1));
  }, [loadRange]);

  useEffect(() => {
    if (!timelineReady || typeof IntersectionObserver === 'undefined') return;
    const root = futureSentinelRef.current?.closest('.app-shell-main-content');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === futureSentinelRef.current) loadFuture();
        if (entry.target === pastSentinelRef.current) loadPast();
      }
    }, { root, rootMargin: '360px 0px' });
    if (futureSentinelRef.current) observer.observe(futureSentinelRef.current);
    if (pastSentinelRef.current) observer.observe(pastSentinelRef.current);
    return () => observer.disconnect();
  }, [loadFuture, loadPast, timelineReady]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-day-date]'));
    const root = elements[0]?.closest('.app-shell-main-content');
    const observer = new IntersectionObserver((entries) => {
      const closest = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top - 72) - Math.abs(b.boundingClientRect.top - 72))[0];
      const date = (closest?.target as HTMLElement | undefined)?.dataset.dayDate;
      if (date) setActiveDate(date);
    }, { root, rootMargin: '-72px 0px -65% 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  useSync(useCallback((event) => {
    if (event.entityType !== 'task') return;
    // Our own move, still reconciling: the optimistic state is already ahead.
    if (isEchoedMove(event)) return;
    // Another session moved a subtree. Its date, collection, depth and every
    // sibling's order may have changed at once, so patching the one row named by
    // the event would leave it in the section it just left. Refetch instead.
    if (isStructuralMove(event) || prefs?.hideCompletedTasks || prefs?.hideOldNotes) {
      replaceTimelineFromApi();
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
          const next = [...prev, { key, label: dayLabel(dateFromISO(key), locale), tasks: [created] }];
          return next.sort((a, b) => (a.key < b.key ? 1 : -1));
        }
        return prev.map((s, i) => (i === existingIdx ? { ...s, tasks: [...s.tasks, created] } : s));
      });
    } else if (event.payload) {
      const updated = apiToTask(event.payload as ApiTask);
      setSections((prev) => rebuildSections(
        prev,
        prev.flatMap((section) => section.tasks).map((task) => task.id === event.entityId ? updated : task),
        locale,
      ));
    }
  }, [locale, replaceTimelineFromApi, prefs?.hideCompletedTasks, prefs?.hideOldNotes, todayKey]));

  const updateSections = useCallback((updater: (prev: DaySection[]) => DaySection[]) => {
    setSections(updater);
  }, []);

  // Drag handling is lifted above the individual TaskLists so a task can move
  // between rendered dates. The sections are a presentation of one flat list, so
  // the hook works on that list and the sections are rebuilt from the result -
  // while preserving every loaded empty day as a valid drop target.
  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections]);
  const setAllTasks = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      setSections((prev) => rebuildSections(prev, updater(prev.flatMap((s) => s.tasks)), locale));
    },
    [locale],
  );

  const { activeDragId } = useTaskDrag({
    tasks: allTasks,
    setTasks: setAllTasks,
    scope: { kind: 'day', dueDate: todayKey },
    onError: replaceTimelineFromApi,
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
        replaceTimelineFromApi();
      });
    }
  }, [prefs?.hideCompletedTasks, updateSections, replaceTimelineFromApi]);

  const scrollToDate = useCallback((date: string) => {
    document.getElementById(`daily-day-${date}`)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const handleDateClick = useCallback(async (date: string) => {
    setActiveDate(date);
    if (!sectionsRef.current.some((section) => section.key === date)) {
      await loadRange(addDaysToISO(date, -7), addDaysToISO(date, 7), date > (sectionsRef.current[0]?.key ?? date));
    }
    requestAnimationFrame(() => scrollToDate(date));
  }, [loadRange, scrollToDate]);

  const handleToday = useCallback(() => {
    void handleDateClick(todayKey);
  }, [handleDateClick, todayKey]);

  useMidnightTimer(
    useCallback(() => {
      const currentToday = fmtISOInTimeZone(new Date(), prefs?.timeZone);
      setRolloverVersion((version) => version + 1);
      void handleDateClick(currentToday);
    }, [handleDateClick, prefs?.timeZone]),
    prefs?.timeZone,
  );

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
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => replaceTimelineFromApi());
      return;
    }

    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
      }))
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
        orderValue: currentTask?.orderValue ?? 0
      }).then((created) => {
        const createdTask = apiToTask(created);
        updateSections((prev) => rebuildSections(
          prev,
          prev
            .flatMap((section) => section.tasks)
            .filter((task) => task.id !== createdTask.id || task.id === id)
            .map((task) => task.id === id ? createdTask : task),
          locale,
        ));
      }).catch(() => {
        updateSections((prev) =>
          prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
        );
      });
    } else {
      apiUpdateTask(id, { title: trimmed }).catch(() => replaceTimelineFromApi());
    }
  }, [locale, replaceTimelineFromApi, todayKey, updateSections]);

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
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => replaceTimelineFromApi());
  }, [replaceTimelineFromApi, updateSections]);

  const calculateMidpointOrder = (tasks: Task[], index: number, type: 'above' | 'below') => {
    const current = tasks[index].orderValue;
    if (type === 'below') {
      const next = index < tasks.length - 1 ? tasks[index + 1].orderValue : current + 2000;
      return Math.floor((current + next) / 2);
    } else {
      const prev = index > 0 ? tasks[index - 1].orderValue : current - 2000;
      return Math.floor((prev + current) / 2);
    }
  };

  const handleAddBelow = useCallback((afterId: string) => {
    const tid = tempId();
    let computedOrderValue = 0;
    updateSections((prev) =>
      prev.map((s) => {
        const idx = s.tasks.findIndex((t) => t.id === afterId);
        if (idx === -1) return s;
        computedOrderValue = calculateMidpointOrder(s.tasks, idx, 'below');
        const next = [...s.tasks];
        next.splice(idx + 1, 0, {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: computedOrderValue,
          indent: s.tasks[idx]?.indent,
          dueDate: s.key,
          type: 'task',
        });
        return { ...s, tasks: next };
      })
    );
    setEditingId(tid);
    setSelectedId(tid);
  }, [updateSections]);

  const handleAddAbove = useCallback((beforeId: string) => {
    const tid = tempId();
    let computedOrderValue = 0;
    updateSections((prev) =>
      prev.map((s) => {
        const idx = s.tasks.findIndex((t) => t.id === beforeId);
        if (idx === -1) return s;
        computedOrderValue = calculateMidpointOrder(s.tasks, idx, 'above');
        const next = [...s.tasks];
        next.splice(idx, 0, {
          id: tid,
          title: '',
          priority: 4,
          isCompleted: false,
          orderValue: computedOrderValue,
          indent: s.tasks[idx]?.indent,
          dueDate: s.key,
          type: 'task',
        });
        return { ...s, tasks: next };
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
      apiUpdateTask(id, { type }).catch(() => replaceTimelineFromApi());
    }
  }, [replaceTimelineFromApi, updateSections]);

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
          apiUpdateTask(id, { parentTaskId }).catch(() => replaceTimelineFromApi());
        }
        return { ...s, tasks: next };
      })
    );
  }, [replaceTimelineFromApi, updateSections]);

  const handleAddToday = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const tid = tempId();
    setInput('');

    const todaySection = sectionsRef.current.find(s => s.key === todayKey);
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
                dueDate: todayKey,
                type: 'task',
              },
            ],
          }
          : s
      )
    );
    const extracted = extractNaturalDate(trimmed, todayKey, locale);

    apiCreateTask({ 
      title: extracted.title, 
      priority: 4, 
      dueDate: extracted.dueDate, 
      type: 'task',
      recurrenceRule: extracted.recurrenceRule,
      orderValue: newOrderValue
    }).then((created) => {
      const createdTask = apiToTask(created);
      updateSections((prev) => rebuildSections(
        prev,
        prev
          .flatMap((section) => section.tasks)
          .filter((task) => task.id !== createdTask.id || task.id === tid)
          .map((task) => task.id === tid ? createdTask : task),
        locale,
      ));
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
        : [...prev, { key: todayKey, label: dayLabel(dateFromISO(todayKey), locale), tasks: [] }];

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

  const handleRightClick = useCallback((id: string, position: { x: number; y: number }) => {
    setSelectedId(id);
    setContextMenu({ taskId: id, position });
  }, []);

  const projectSubmenuItems: ContextMenuItem[] = [
    ...collections
      .filter((c) => !c.isInbox)
      .map<ContextMenuItem>((c) => ({
        type: 'item',
        label: c.name,
        icon: (
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: paletteColorHex(c.color) }}
          />
        ),
        onClick: () => {
          if (contextMenu?.taskId) {
            apiUpdateTask(contextMenu.taskId, { collectionId: c.id }).catch(() => replaceTimelineFromApi());
          }
        },
      })),
    {
      type: 'item',
      label: 'No project',
      icon: (
        <span
          className="w-2 h-2 rounded-full inline-block bg-transparent border border-ink/20"
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            apiUpdateTask(contextMenu.taskId, { collectionId: inbox.id }).catch(() => replaceTimelineFromApi());
          }
        }
      },
    } satisfies ContextMenuItem,
  ];

  return (
    <div
      className="daily-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <div className="daily-timeline-layout">
        <div className="daily-timeline-main min-w-0">
          <header className="page-header-copy sticky-page-header max-w-162">
            <h1 className="m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink">
              {t('page.daily')}
            </h1>
            <p className="page-header-subtitle daily-page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
              {phrase}
            </p>
          </header>

          <div className="page-header-toolbar daily-page-header-controls sticky top-6 z-20 -mt-6 ml-auto flex w-fit items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleToday}>
              {t('page.today')}
            </Button>
            <TaskVisibilityControls
              hideCompletedTasks={prefs?.hideCompletedTasks ?? false}
              hideOldNotes={prefs?.hideOldNotes ?? false}
              disabled={!prefs || visibilityPreferencesPending}
              onHideCompletedTasksChange={setHideCompletedTasks}
              onHideOldNotesChange={setHideOldNotes}
            />
          </div>
        </div>

        <div className="daily-timeline-sidebar">
          <CalendarWidget
            key={activeDate.slice(0, 7)}
            activeDate={activeDate}
            today={todayKey}
            locale={locale}
            weekStart={prefs?.weekStart ?? 'sunday'}
            loadedStart={loadedStart}
            loadedEnd={loadedEnd}
            onDateClick={(date) => { void handleDateClick(date); }}
          />
        </div>

        <div className="daily-timeline-feed max-w-162" aria-label={locale === 'pt-BR' ? 'Linha do tempo diária' : 'Daily timeline'}>
            <div ref={futureSentinelRef} className="daily-timeline-sentinel" aria-hidden />
            {sections.map((section) => {
              const isToday = section.key === todayKey;
              const dimNotes = section.key < todayKey;
              const ownsTransientUi = section.tasks.some((task) => task.id === editingId || task.id === contextMenu?.taskId);
              return (
                <VirtualDay
                  key={section.key}
                  date={section.key}
                  keepMounted={isToday || Boolean(activeDragId) || ownsTransientUi}
                  className={`daily-timeline-day mt-6 ${isToday ? 'daily-timeline-day--today' : ''}`}
                >
                  <div className="daily-timeline-day__heading text-[11px] tracking-[0.08em] uppercase text-ink-light leading-6 h-6 m-0 font-medium">
                    <span>{section.label}</span>
                    {isToday && <span className="daily-timeline-day__today-mark">{t('page.today')}</span>}
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
                    onRightClick={handleRightClick}
                  />

                  {isToday && (
                    <form onSubmit={handleAddToday} className="flex items-center h-6">
                      <span className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
                        •
                      </span>
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleAddTodayKeyDown}
                        placeholder={t('common.addTask')}
                        className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
                        spellCheck={false}
                      />
                    </form>
                  )}
                </VirtualDay>
              );
            })}
            <div ref={pastSentinelRef} className="daily-timeline-sentinel" aria-hidden />
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            { type: 'item', label: 'Date', disabled: true },
            { type: 'item', label: 'Priority', disabled: true },
            { type: 'item', label: 'Project', submenu: projectSubmenuItems },
            { type: 'item', label: 'Tags', disabled: true },
            { type: 'separator' },
            { type: 'item', label: 'Add above', onClick: () => handleAddAbove(contextMenu.taskId) },
            { type: 'item', label: 'Add below', onClick: () => handleAddBelow(contextMenu.taskId) },
            { type: 'separator' },
            { type: 'item', label: 'Delete', destructive: true, onClick: () => handleDelete(contextMenu.taskId) },
          ]}
        />
      )}
    </div>
  );
}
