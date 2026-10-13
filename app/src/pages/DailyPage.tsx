import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSync } from '../hooks/useSync';
import { useReorganize, type Section as ReorganizeSection } from '../hooks/useReorganize';
import { isEchoedMove, isStructuralMove } from '../utils/moveEcho';
import { TaskVisibilityControls } from '../components/TaskVisibilityControls';
import { PageHeader } from '../components/PageHeader';
import { CollectionChip } from '../components/ui/Chip';
import { Button } from '../components/ui/Button';
import { ViewSwitcher } from '../components/ui/ViewSwitcher';
import { Toolbar } from '../components/ui/Toolbar';
import { ToolbarSectionLabel } from '../components/ui/ToolbarSectionLabel';
import { DailyWeekBoard } from '../components/board/DailyWeekBoard';
import { WeekSelector } from '../components/board/WeekSelector';
import { DailyList } from '../components/daily/DailyList';
import { MonthlyView } from '../components/monthly/MonthlyView';
import type { Task } from '../components/TaskItem';
import { extractNaturalDate, fmtISO, fmtISOInTimeZone, startOfWeek } from '../utils/date';
import { nextOrderValue } from '../utils/order';
import { applyIndent, getParentCandidate } from '../utils/taskTree';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useMidnightTimer } from '../hooks/useMidnightTimer';
import { useDailyTasks } from '../hooks/useDailyTasks';
import { useI18n } from '../i18n/I18nContext';
import {
  fetchCollections,
  fetchPreferences,
  apiToggleTask,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
  type ApiTask,
} from '../api/client';
import { ContextMenu, type ContextMenuItem } from '../components/ui/ContextMenu';
import { flattenCollections } from '../components/CollectionTreeNav';
import { Folder, ArrowUp, ArrowDown, Trash2, Calendar, Kanban, List } from 'lucide-react';
import { withTimeZones } from '../utils/taskTime';
import { addDaysISO, apiToTask, buildSections, dateFromISO, dayLabel, flattenDaily } from '../utils/dailySections';
import { dailyRange, viewToSlug } from '../utils/dailyRange';
import type { DaySection } from '../types/daily';
import type { BoardViewMode } from '../types/board';
import { buildSetDateMenuItem } from '../components/taskDateMenuItem';
import type { TaskSchedule } from '../types/task';

let tempCounter = 0;
function tempId() { return `temp-daily-${++tempCounter}`; }

export function DailyPage({ view }: { view: BoardViewMode }) {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null);
  const [pageContextMenu, setPageContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [input, setInput] = useState('');
  const [selectedWeekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [selectedMonthAnchor, setMonthAnchor] = useState<Date | null>(null);
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
  const dailyBoard = view === 'kanban-list' || view === 'kanban';
  const setView = useCallback((next: BoardViewMode) => navigate(`/daily/${viewToSlug(next)}`), [navigate]);

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const [now, setNow] = useState(() => new Date());
  const todayKey = useMemo(() => fmtISOInTimeZone(now, prefs?.timeZone), [now, prefs?.timeZone]);
  // Until the user navigates, the visible week and month follow today in the preferred time zone.
  const weekAnchor = useMemo(() => selectedWeekAnchor ?? dateFromISO(todayKey), [selectedWeekAnchor, todayKey]);
  const monthAnchor = useMemo(() => selectedMonthAnchor ?? dateFromISO(todayKey), [selectedMonthAnchor, todayKey]);

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
  const weekStartKey = fmtISO(startOfWeek(weekAnchor, weekStart));
  // The list follows today until the week selector moves it to another week.
  const browsingWeek = view === 'list' && weekStartKey !== fmtISO(startOfWeek(dateFromISO(todayKey), weekStart));

  const range = useMemo(
    () => dailyRange(
      browsingWeek ? 'kanban-list' : view,
      view === 'calendar' ? monthAnchor : view === 'list' && !browsingWeek ? dateFromISO(todayKey) : weekAnchor,
      weekStart,
    ),
    [view, browsingWeek, monthAnchor, weekAnchor, todayKey, weekStart],
  );
  const { data: daily, isError: dailyFailed, refresh: refreshDaily } = useDailyTasks(range.from, range.to);

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

  // Dropping the anchors makes the week and month follow today again.
  const goToToday = useCallback(() => {
    setWeekAnchor(null);
    setMonthAnchor(null);
    handleToday();
  }, [handleToday]);

  useMidnightTimer(
    useCallback(() => {
      setNow(new Date());
      refreshDaily();
      handleToday();
    }, [refreshDaily, handleToday]),
    prefs?.timeZone,
  );

  const {
    isPending: visibilityPreferencesPending,
    setHideCompletedTasks,
    setShowNotes,
  } = useTaskVisibilityPreferences(prefs, refreshDaily);

  useEffect(() => {
    window.addEventListener('task-created', refreshDaily);
    return () => window.removeEventListener('task-created', refreshDaily);
  }, [refreshDaily]);

  useSync(useCallback((event) => {
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
  }, [locale, refreshDaily, prefs?.hideCompletedTasks, prefs?.showNotes, todayKey]));

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
    onError: refreshDaily,
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
          apiUpdateTask(id, { parentTaskId }).catch(() => refreshDaily());
        }
        return { ...s, tasks: next };
      })
    );
  }, [refreshDaily, updateSections]);

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

  const handleRightClick = useCallback((id: string, position: { x: number; y: number }) => {
    setSelectedId(id);
    setContextMenu({ taskId: id, position });
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
  }, [collections, contextMenu?.taskId, setAllTasks, apiUpdateTask, refreshDaily, t]);

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

  // A browsed week shows every day, empty ones included, so each can take a task.
  const browsedDays = useMemo(() => {
    if (!browsingWeek) return null;
    return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartKey, i))
      .map((key) => sections.find((s) => s.key === key)
        ?? { key, label: dayLabel(dateFromISO(key), locale, dateFormat), tasks: [] });
  }, [browsingWeek, weekStartKey, sections, locale, dateFormat]);

  const futureDays = useMemo<DaySection[]>(() => {
    if (view !== 'list' || browsingWeek) return [];
    const days = [];
    for (let key = addDaysISO(todayKey, 1); key <= range.to; key = addDaysISO(key, 1)) {
      days.push(sections.find((s) => s.key === key)
        ?? { key, label: dayLabel(dateFromISO(key), locale, dateFormat), tasks: [] });
    }
    return days;
  }, [view, browsingWeek, todayKey, range.to, sections, locale, dateFormat]);

  // The week shown by the list keeps its earlier days, empty ones included.
  const pastDays = useMemo<DaySection[]>(() => {
    if (view !== 'list' || browsingWeek || reorg.state === 'preview') return [];
    const days = [];
    for (let key = weekStartKey; key < todayKey; key = addDaysISO(key, 1)) {
      days.push(sections.find((s) => s.key === key)
        ?? { key, label: dayLabel(dateFromISO(key), locale, dateFormat), tasks: [] });
    }
    return days;
  }, [view, browsingWeek, reorg.state, weekStartKey, todayKey, sections, locale, dateFormat]);

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
        toolbar={
          <Toolbar className="daily-page-header-controls" viewSwitcher={
            <>
              <ViewSwitcher view={view} onViewChange={setView} />
            </>
          }>
            {reorg.state === 'preview' ? (
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
            ) : (
              reorg.showButton && (
                <Button variant="secondary" size="xs" onClick={reorg.startPreview}>
                  {t('reorganize.button')}
                </Button>
              )
            )}

            <ToolbarSectionLabel>{t('menu.show')}</ToolbarSectionLabel>
            <TaskVisibilityControls
              hideCompletedTasks={prefs?.hideCompletedTasks ?? false}
              showNotes={prefs?.showNotes ?? true}
              disabled={!prefs || visibilityPreferencesPending}
              onHideCompletedTasksChange={setHideCompletedTasks}
              onShowNotesChange={setShowNotes}
            />
          </Toolbar>
        }
      />

      {pageContextMenu && (
        <ContextMenu
          position={pageContextMenu}
          onClose={() => setPageContextMenu(null)}
          items={[
            { type: 'item', label: t('toolbar.list'), icon: <List size={14} />, onClick: () => setView('list') },
            { type: 'item', label: t('toolbar.kanbanLists'), icon: <Kanban size={14} />, onClick: () => setView('kanban-list') },
            { type: 'item', label: t('toolbar.kanbanCards'), icon: <Kanban size={14} />, onClick: () => setView('kanban') },
            { type: 'item', label: t('toolbar.calendar'), icon: <Calendar size={14} />, onClick: () => setView('calendar') },
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

      {view === 'calendar' ? (
        <div className="max-w-[832px]">
          <div className="h-6" />
          <MonthlyView
            tasks={allTasks}
            onToggle={handleToggle}
            visibleMonth={{ year: monthAnchor.getFullYear(), month: monthAnchor.getMonth() }}
            onMonthChange={(year, month) => setMonthAnchor(new Date(year, month, 1))}
          />
        </div>
      ) : dailyBoard ? (
        <DailyWeekBoard
          tasks={allTasks}
          weekAnchor={weekAnchor}
          today={dateFromISO(todayKey)}
          todayKey={todayKey}
          weekStart={weekStart}
          dateFormat={dateFormat}
          onWeekChange={setWeekAnchor}
          onToday={goToToday}
          onToggle={handleToggle}
          onCreate={handleBoardCreate}
          presentation={view}
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
        <div className="daily-list-nav flex max-w-162 justify-start">
          <WeekSelector weekAnchor={weekAnchor} today={dateFromISO(todayKey)} weekStart={weekStart} onWeekChange={setWeekAnchor} onToday={goToToday} />
        </div>
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

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            // { type: 'item', label: 'Date', icon: <Calendar size={14} />, disabled: true },
            // { type: 'item', label: 'Priority', icon: <Tag size={14} />, disabled: true },
            buildSetDateMenuItem(t, allTasks.find((task) => task.id === contextMenu.taskId), handleSetSchedule),
            { type: 'item', label: t('contextMenu.collection'), icon: <Folder size={14} />, submenu: projectSubmenuItems },
            // { type: 'item', label: 'Tags', icon: <Hash size={14} />, disabled: true },
            { type: 'separator' },
            { type: 'item', label: t('contextMenu.addAbove'), icon: <ArrowUp size={14} />, onClick: () => handleAddAbove(contextMenu.taskId) },
            { type: 'item', label: t('contextMenu.addBelow'), icon: <ArrowDown size={14} />, onClick: () => handleAddBelow(contextMenu.taskId) },
            { type: 'separator' },
            { type: 'item', label: t('common.delete'), icon: <Trash2 size={14} />, destructive: true, onClick: () => handleDelete(contextMenu.taskId) },
          ]}
        />
      )}
    </div>
  );
}
