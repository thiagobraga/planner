import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useSync } from '../hooks/useSync';
import { useReorganize, type Section as ReorganizeSection } from '../hooks/useReorganize';
import { isEchoedMove, isStructuralMove } from '../utils/moveEcho';
import { PageHeader } from '../components/PageHeader';
import { CollectionChip } from '../components/ui/Chip';
import { DailyWeekBoard } from '../components/board/DailyWeekBoard';
import { DailyToolbar } from '../components/daily/DailyToolbar';
import { DailyList } from '../components/daily/DailyList';
import { MonthlyView } from '../components/monthly/MonthlyView';

import { extractNaturalDate, fmtISOInTimeZone } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { getParentCandidate } from '../utils/taskTree';
import { resolveTaskIndent } from '../utils/taskIndent';
import { persistTaskIndent } from '../utils/persistTaskIndent';
import { buildIndentMenuItems } from '../components/taskIndentMenu';
import type { TaskIndentHandler, TaskIndentMenuContext, TaskListContextMenuHandler } from '../types/taskIndent';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useMidnightTimer } from '../hooks/useMidnightTimer';
import { useDailyTasks } from '../hooks/useDailyTasks';
import { useI18n } from '../i18n/I18nContext';
import { fetchCollections, fetchSections, fetchCollectionView, fetchPreferences, apiToggleTask, apiCreateTask, apiUpdateTask, apiDeleteTask, apiMoveTask } from '../api/client';
import type { ApiTask } from '../types/api';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';
import { flattenCollections } from '../components/CollectionTreeNav';
import { Folder, ArrowUp, ArrowDown, Trash2, Columns3, List } from 'lucide-react';
import { applySchedule, withTimeZones } from '../utils/taskTime';
import { apiToTask, buildSections, dateFromISO, dayLabel, flattenDaily } from '../utils/dailySections';
import { listDays } from '../utils/dailyListDays';
import { useDailyView } from '../hooks/useDailyView';
import type { DaySection } from '../types/daily';
import type { ViewLayout } from '../types/view';
import { buildSetDateMenuItem } from '../components/taskDateMenuItem';
import type { Task, TaskSchedule } from '../types/task';
import { blurOnEscape } from '../utils/editableText';
import { buildTaskMenuActions } from '../utils/taskMenuActions';

let tempCounter = 0;
function tempId() { return `temp-daily-${++tempCounter}`; }

export function DailyPage({ layout }: { layout: ViewLayout }) {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<TaskIndentMenuContext | null>(null);
  const [indentError, setIndentError] = useState(false);
  const [pageContextMenu, setPageContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [input, setInput] = useState('');
  const [futureInputs, setFutureInputs] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLDivElement>(null);
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const [now, setNow] = useState(() => new Date());
  const todayKey = useMemo(() => fmtISOInTimeZone(now, prefs?.timeZone), [now, prefs?.timeZone]);
  const view = useDailyView(layout, prefs, todayKey);
  const monthLog = layout === 'list' && view.range === 'month';

  const dateFormat = prefs?.dateFormat ?? 'MMM DD ddd';
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const dateFormatRef = useRef(dateFormat);
  useEffect(() => {
    dateFormatRef.current = dateFormat;
  }, [dateFormat]);

  const weekStart = prefs?.weekStart ?? 'sunday';
  // A List that includes today asks only from today on: earlier days arrive as overdue, in their own day.
  const fetchFrom = layout === 'list' && !monthLog && view.includesToday ? todayKey : view.from;
  const { data: daily, isError: dailyFailed, refresh: refreshDaily } = useDailyTasks(fetchFrom, view.to);

  // Rebuilt when preferences (locale/dateFormat) arrive after the data, so the
  // labels settle without another round trip. Local edits live in `sections`
  // until the next response replaces them.
  useEffect(() => {
    if (daily) setSections(buildSections(flattenDaily(daily).map(apiToTask), locale, todayKey, dateFormat));
    else if (dailyFailed) setSections(buildSections([], locale, todayKey, dateFormat));
  }, [daily, dailyFailed, locale, todayKey, dateFormat]);

  // Convert DaySection[] to ReorganizeSection[] for useReorganize hook
  const reorganizeSections = useMemo<ReorganizeSection[] | null>(
    () =>
      sections.filter((s) => s.key <= todayKey).map((s) => ({
        date: s.key,
        label: s.label,
        tasks: s.tasks,
      })),
    [sections, todayKey],
  );

  const formatReorganizeLabel = useCallback(
    (dateStr: string) => dayLabel(dateFromISO(dateStr), locale, prefs?.dateFormat),
    [locale, prefs?.dateFormat],
  );

  const reorg = useReorganize(
    todayKey,
    reorganizeSections,
    undefined,
    undefined,
    formatReorganizeLabel,
    refreshDaily,
  );

  const handleToday = useCallback(() => {
    todaySectionRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  // Dropping the anchor makes the range follow today again.
  const goToToday = useCallback(() => {
    view.today();
    handleToday();
  }, [view, handleToday]);

  useMidnightTimer(
    useCallback(() => {
      setNow(new Date());
      refreshDaily();
      handleToday();
    }, [refreshDaily, handleToday]),
    prefs?.timeZone,
  );

  const { setHideCompletedTasks, setShowNotes } = useTaskVisibilityPreferences(prefs, refreshDaily);

  useEffect(() => {
    window.addEventListener('task-created', refreshDaily);
    return () => window.removeEventListener('task-created', refreshDaily);
  }, [refreshDaily]);

  useSync(useCallback((event) => {
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
        }))
      );
    }
  }, [locale, qc, refreshDaily, prefs?.hideCompletedTasks, prefs?.showNotes, todayKey]));

  const updateSections = useCallback((updater: (prev: DaySection[]) => DaySection[]) => {
    setSections(updater);
  }, []);

  // Drag handling is lifted above the individual TaskLists so a task can move
  // between rendered dates. The sections are a presentation of one flat list, so
  // the hook works on that list and the sections are rebuilt from the result -
  // which also drops an overdue section once its last task leaves, while
  // buildSections keeps Today rendered even when empty.
  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections]);
  const menuTask = allTasks.find((task) => task.id === contextMenu?.taskId);
  const { data: menuCollection } = useQuery({
    queryKey: ['collection', menuTask?.collectionId],
    queryFn: () => fetchCollectionView(menuTask!.collectionId!),
    enabled: Boolean(contextMenu && menuTask?.collectionId),
  });
  const setAllTasks = useCallback(
    (updater: (prev: Task[]) => Task[]) => {
      setSections((prev) =>
        buildSections(updater(prev.flatMap((s) => s.tasks)), locale, todayKey, dateFormat),
      );
    },
    [locale, todayKey, dateFormat],
  );

  const { activeDragId } = useTaskDrag({
    tasks: allTasks,
    setTasks: setAllTasks,
    scope: { kind: 'day', dueDate: todayKey },
    onError: () => { setIndentError(true); refreshDaily(); },
    // Daily spans every collection, so a move here can reorder a list Inbox or a
    // Collection page is caching.
    onMoved: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  // Daily spans collections, so each row states which one it belongs to.
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const sectionCollectionIds = useMemo(
    () => [...new Set(allTasks.filter((t) => t.sectionId && t.collectionId).map((t) => t.collectionId as string))],
    [allTasks],
  );
  const sectionNames = useQueries({
    queries: sectionCollectionIds.map((id) => ({ queryKey: ['sections', id], queryFn: () => fetchSections(id) })),
    combine: (results) => new Map(results.flatMap((r) => r.data ?? []).map((s) => [s.id, s.name])),
  });
  const renderBadge = useCallback(
    (task: Task) => {
      const collection = collections.find((c) => c.id === task.collectionId);
      if (!collection || collection.isInbox) return null;
      const section = task.sectionId ? sectionNames.get(task.sectionId) : undefined;
      return <CollectionChip name={collection.name} color={collection.color} section={section} />;
    },
    [collections, sectionNames],
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
        refreshDaily();
      });
    }
  }, [prefs?.hideCompletedTasks, updateSections, refreshDaily]);

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
      if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
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
      apiUpdateTask(id, { title: trimmed }).catch(() => refreshDaily());
    }
  }, [locale, refreshDaily, updateSections, todayKey]);

  const handleEditCancel = useCallback((id: string) => {
    setEditingId(undefined);
    if (id.startsWith('temp-')) {
      updateSections((prev) =>
        prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
      );
    }
  }, [updateSections]);

  const handleSetSchedule = useCallback((id: string, schedule: TaskSchedule) => {
    setAllTasks((prev) => prev.map((task) => (task.id === id ? applySchedule(task, schedule) : task)));
    apiUpdateTask(id, withTimeZones(schedule))
      .then((updated) => setAllTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...apiToTask(updated) } : task))))
      .catch(() => refreshDaily());
  }, [setAllTasks, refreshDaily]);

  const handleDelete = useCallback((id: string) => {
    updateSections((prev) =>
      prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
    );
    setEditingId(undefined);
    if (!id.startsWith('temp-')) apiDeleteTask(id).catch(() => refreshDaily());
  }, [refreshDaily, updateSections]);

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
          type: 'task',
        });
        return { ...s, tasks: next };
      })
    );
    setEditingId(tid);
    setSelectedId(tid);
  }, [updateSections]);

  const handleConvertType = useCallback((id: string, type: 'task' | 'note' | 'event') => {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, type } : t)),
      }))
    );
    if (!id.startsWith('temp-')) {
      apiUpdateTask(id, { type }).catch(() => refreshDaily());
    }
  }, [refreshDaily, updateSections]);

  const handleIndent: TaskIndentHandler = useCallback((id, dir, visibleTasks, scope) => {
    const move = resolveTaskIndent(visibleTasks, id, dir, scope);
    if (!move) return;
    setIndentError(false);
    persistTaskIndent(id, move, sectionsRef.current.flatMap((section) => section.tasks), setAllTasks, refreshDaily, () => {
      setIndentError(true);
      refreshDaily();
    });
  }, [refreshDaily, setAllTasks]);

  const handleAddToday = (text: string) => {
    const trimmed = text.trim();
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

  const handleBoardCreate = async (title: string, dueDate?: string) => {
    const created = apiToTask(await apiCreateTask({ title, dueDate, priority: 4, type: 'task' }));
    // An older board response must not replace the card we just saved.
    await qc.cancelQueries({ queryKey: ['daily'] });
    setAllTasks((tasks) => [...tasks.filter((task) => task.id !== created.id), created]);
    qc.invalidateQueries({ queryKey: ['inbox'] });
    qc.invalidateQueries({ queryKey: ['collection'] });
  };

  const handleAddFuture = (dateKey: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tid = tempId();
    setFutureInputs((prev) => ({ ...prev, [dateKey]: '' }));

    const section = sectionsRef.current.find((s) => s.key === dateKey);
    const newOrderValue = nextOrderValue(section ? section.tasks : []);

    const row: Task = { id: tid, title: trimmed, priority: 4, isCompleted: false, orderValue: newOrderValue, type: 'task' };
    updateSections((prev) =>
      prev.some((s) => s.key === dateKey)
        ? prev.map((s) => (s.key === dateKey ? { ...s, tasks: [...s.tasks, row] } : s))
        : [...prev, { key: dateKey, label: dayLabel(dateFromISO(dateKey), locale, dateFormat), tasks: [row] }]
    );

    apiCreateTask({
      title: trimmed,
      priority: 4,
      dueDate: dateKey,
      type: 'task',
      orderValue: newOrderValue,
    }).then((created) => {
      const createdTask = apiToTask(created);
      updateSections((prev) =>
        prev.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === tid ? createdTask : t)),
        }))
      );
    }).catch(() => {
      // keep local version - it's in localStorage
    });
  };

  const handleAddTodayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
          : s
      );
    });

    setEditingId(tid);
  };

  const handleRightClick: TaskListContextMenuHandler = useCallback((id, position, visibleTasks, scope) => {
    setSelectedId(id);
    setContextMenu({ taskId: id, position, visibleTasks, scope });
  }, []);

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = flattenCollections(collections).map((c) => ({
      type: 'item' as const,
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          const taskId = contextMenu.taskId;
          setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, collectionId: c.id } : t)));
          apiUpdateTask(taskId, { collectionId: c.id }).catch(() => refreshDaily());
        }
      },
    }));

    items.push({
      type: 'item' as const,
      label: t('contextMenu.noCollection'),
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20"
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            const taskId = contextMenu.taskId;
            setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, collectionId: inbox.id } : t)));
            apiUpdateTask(taskId, { collectionId: inbox.id }).catch(() => refreshDaily());
          }
        }
      },
    });

    return items;
  }, [collections, contextMenu?.taskId, setAllTasks, refreshDaily, t]);

  // Keep redistributed future dates visible even when they extend past this week.
  const previewFutureSections = useMemo(
    () =>
      reorg.state === 'preview'
        ? (reorg.previewSections ?? [])
            .filter((s) => s.date > todayKey)
            .map((s) => ({ key: s.date, label: s.label, tasks: s.tasks as Task[] }))
        : null,
    [reorg.state, reorg.previewSections, todayKey],
  );
  const previewTodaySections = useMemo(
    () =>
      reorg.state === 'preview'
        ? (reorg.previewSections ?? [])
            .filter((s) => s.date <= todayKey)
            .map((s) => ({ key: s.date, label: s.label, tasks: s.tasks as Task[] }))
            .reverse()
        : null,
    [reorg.state, reorg.previewSections, todayKey],
  );

  const { past: pastDays, future: futureDays, browsed: browsedDays } = useMemo(
    () => listDays({
      sections,
      from: view.from,
      to: view.to,
      todayKey,
      hideEmptyDays: view.hideEmptyDays,
      preview: reorg.state === 'preview',
      locale,
      dateFormat,
    }),
    [sections, view.from, view.to, view.hideEmptyDays, todayKey, reorg.state, locale, dateFormat],
  );

  return (
    <div
      className="daily-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, [contenteditable], button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest('input, [contenteditable], button, [role="button"], [data-task-id], [data-card-id]')) return;
        event.preventDefault();
        setPageContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <PageHeader
        title={t('page.daily')}
        actions={
          <DailyToolbar
            view={view}
            todayKey={todayKey}
            weekStart={weekStart}
            onToday={goToToday}
            onReorganize={reorg.showButton && reorg.state !== 'preview' ? reorg.startPreview : undefined}
          />
        }
        afterTitle={reorg.state === 'preview' && (
          <span className="reorganize-confirm inline-flex items-center gap-1 text-[13px]">
            {t('reorganize.confirm')}
            <button
              className="text-accent underline text-decoration-color-accent cursor-pointer hover:opacity-80"
              onClick={() => {
                reorg.confirmReorganize().catch((err) => console.error('Reorganize failed', err));
              }}
            >
              {t('common.yes')}
            </button>
            <span>·</span>
            <button
              className="text-accent underline text-decoration-color-accent cursor-pointer hover:opacity-80"
              onClick={reorg.cancelReorganize}
            >
              {t('common.no')}
            </button>
          </span>
        )}
      />

      {pageContextMenu && (
        <ContextMenu
          caret={false}
          position={pageContextMenu}
          onClose={() => setPageContextMenu(null)}
          items={[
            { type: 'item', label: t('view.layout.list'), icon: <List size={14} />, checked: layout === 'list', onClick: () => view.setLayout('list') },
            { type: 'item', label: t('view.layout.columns'), icon: <Columns3 size={14} />, checked: layout === 'columns', onClick: () => view.setLayout('columns') },
            { type: 'separator' },
            { type: 'item', label: t('view.style.notebook'), checked: view.style === 'notebook', onClick: () => view.setStyle('notebook') },
            { type: 'item', label: t('view.style.cards'), checked: view.style === 'cards', onClick: () => view.setStyle('cards') },
            { type: 'separator' },
            {
              type: 'item',
              label: `${prefs?.hideCompletedTasks ? '○' : '✓'} ${t('visibility.completedTasks')}`,
              onClick: () => setHideCompletedTasks(!(prefs?.hideCompletedTasks ?? false)),
            },
            {
              type: 'item',
              label: `${(prefs?.showNotes ?? true) ? '✓' : '○'} ${t('visibility.notes')}`,
              onClick: () => setShowNotes(!(prefs?.showNotes ?? true)),
            },
          ]}
        />
      )}

      {monthLog ? (
        <div>
          <div className="h-6" />
          <MonthlyView
            tasks={allTasks}
            onToggle={handleToggle}
            onTaskContextMenu={handleRightClick}
            visibleMonth={{ year: dateFromISO(view.from).getFullYear(), month: dateFromISO(view.from).getMonth() }}
            hideSelector
          />
        </div>
      ) : layout === 'columns' ? (
        <DailyWeekBoard
          tasks={allTasks}
          from={view.from}
          to={view.to}
          todayKey={todayKey}
          dateFormat={dateFormat}
          onToggle={handleToggle}
          onCreate={handleBoardCreate}
          presentation={view.style === 'cards' ? 'kanban' : 'kanban-list'}
          taskListProps={{
            activeDragId,
            editingId,
            renderBadge,
            onStartEdit: handleStartEdit,
            onEditCommit: handleEditCommit,
            onEditCancel: handleEditCancel,
            onDelete: handleDelete,
            onAddBelow: handleAddBelow,
            onIndent: handleIndent,
            onConvertType: handleConvertType,
            onRightClick: handleRightClick,
          }}
        />
      ) : (
        <>
        <DailyList
          pastSections={pastDays}
          futureSections={previewFutureSections ?? browsedDays ?? futureDays}
          currentSections={previewTodaySections ?? (browsedDays ? [] : sections.filter((section) => section.key <= todayKey))}
          todayKey={todayKey}
          isPreview={previewFutureSections !== null}
          todaySectionRef={todaySectionRef}
          inputRef={inputRef}
          input={input}
          onInputChange={setInput}
          onAddToday={handleAddToday}
          onAddTodayKeyDown={handleAddTodayKeyDown}
          futureInputs={futureInputs}
          onFutureInputChange={(dateKey, text) => setFutureInputs((prev) => ({ ...prev, [dateKey]: text }))}
          onAddFuture={handleAddFuture}
          onTaskToggle={handleToggle}
          taskListProps={{
            activeDragId,
            editingId,
            renderBadge,
            onStartEdit: handleStartEdit,
            onEditCommit: handleEditCommit,
            onEditCancel: handleEditCancel,
            onDelete: handleDelete,
            onAddBelow: handleAddBelow,
            onIndent: handleIndent,
            onConvertType: handleConvertType,
            onRightClick: handleRightClick,
          }}
        />
        </>
      )}

      {indentError && <div role="alert" className="text-accent text-sm mt-6">{t('task.moveFailed')}</div>}
      {contextMenu && (
        <ContextMenu
          caret
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            ...buildTaskMenuActions({
              task: menuTask,
              statuses: menuCollection?.statuses ?? [],
              completionStatusId: menuCollection?.completionStatusId ?? null,
              t,
              onToggle: () => handleToggle(contextMenu.taskId),
              onMove: (statusId) => {
                if (!menuTask?.collectionId || menuTask.parentTaskId) return;
                apiMoveTask(menuTask.id, { parentTaskId: null, collectionId: menuTask.collectionId, statusId, scope: { kind: 'status', collectionId: menuTask.collectionId, statusId }, position: Number.MAX_SAFE_INTEGER })
                  .then(() => { refreshDaily(); qc.invalidateQueries({ queryKey: ['collection', menuTask.collectionId] }); })
                  .catch(() => refreshDaily());
              },
            }),
            // { type: 'item', label: 'Date', icon: <Calendar size={14} />, disabled: true },
            // { type: 'item', label: 'Priority', icon: <Tag size={14} />, disabled: true },
            buildSetDateMenuItem(t, allTasks.find((task) => task.id === contextMenu.taskId), handleSetSchedule),
            { type: 'item', label: t('contextMenu.collection'), icon: <Folder size={14} />, submenu: projectSubmenuItems },
            // { type: 'item', label: 'Tags', icon: <Hash size={14} />, disabled: true },
            { type: 'separator' },
            { type: 'item', label: t('contextMenu.addAbove'), icon: <ArrowUp size={14} />, onClick: () => handleAddAbove(contextMenu.taskId) },
            { type: 'item', label: t('contextMenu.addBelow'), icon: <ArrowDown size={14} />, onClick: () => handleAddBelow(contextMenu.taskId) },
            ...buildIndentMenuItems(t, contextMenu, handleIndent),
            { type: 'separator' },
            { type: 'item', label: t('common.delete'), icon: <Trash2 size={14} />, destructive: true, onClick: () => handleDelete(contextMenu.taskId) },
          ]}
        />
      )}
    </div>
  );
}
