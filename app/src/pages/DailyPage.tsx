import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useReorganize, type Section as ReorganizeSection } from '../hooks/useReorganize';
import { PageHeader } from '../components/PageHeader';
import { CollectionChip } from '../components/ui/Chip';
import { DailyWeekBoard } from '../components/board/DailyWeekBoard';
import { DailyToolbar } from '../components/daily/DailyToolbar';
import { DailyList } from '../components/daily/DailyList';
import {
  DailyPageContextMenu,
  DailyReorganizeConfirm,
  DailyTaskContextMenu,
} from '../components/daily/DailyOverlays';
import { MonthlyView } from '../components/monthly/MonthlyView';
import { fmtISOInTimeZone } from '../utils/date';
import type { TaskIndentMenuContext, TaskListContextMenuHandler } from '../types/taskIndent';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useTaskVisibilityPreferences } from '../hooks/useTaskVisibilityPreferences';
import { useMidnightTimer } from '../hooks/useMidnightTimer';
import { useDailyTasks } from '../hooks/useDailyTasks';
import { usePreferences } from '../hooks/usePreferences';
import { useDailySync } from '../hooks/useDailySync';
import { useDailyTaskActions } from '../hooks/useDailyTaskActions';
import { useI18n } from '../i18n/I18nContext';
import { fetchCollections, fetchSections, fetchCollectionView, apiUpdateTask, apiMoveTask } from '../api/client';
import { apiToTask, buildSections, dateFromISO, dayLabel, flattenDaily } from '../utils/dailySections';
import { listDays } from '../utils/dailyListDays';
import { useDailyView } from '../hooks/useDailyView';
import type { DaySection } from '../types/daily';
import type { ViewLayout } from '../types/view';
import type { Task } from '../types/task';

export function DailyPage({ layout }: { layout: ViewLayout }) {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [contextMenu, setContextMenu] = useState<TaskIndentMenuContext | null>(null);
  const [pageContextMenu, setPageContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const todaySectionRef = useRef<HTMLDivElement>(null);

  const { data: prefs } = usePreferences();

  const [now, setNow] = useState(() => new Date());
  const todayKey = useMemo(() => fmtISOInTimeZone(now, prefs?.timeZone), [now, prefs?.timeZone]);
  const view = useDailyView(layout, prefs, todayKey);
  const monthLog = layout === 'list' && view.range === 'month';

  const dateFormat = prefs?.dateFormat ?? 'MMM DD ddd';
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
      sections
        .filter((s) => s.key <= todayKey)
        .map((s) => ({
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

  useDailySync({
    locale,
    todayKey,
    prefs,
    refreshDaily,
    setSections,
  });

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
      setSections((prev) => buildSections(updater(prev.flatMap((s) => s.tasks)), locale, todayKey, dateFormat));
    },
    [locale, todayKey, dateFormat],
  );

  const {
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
  } = useDailyTaskActions({
    locale,
    todayKey,
    dateFormat,
    prefs,
    sections,
    setSections,
    setAllTasks,
    refreshDaily,
  });

  const { activeDragId } = useTaskDrag({
    tasks: allTasks,
    setTasks: setAllTasks,
    scope: { kind: 'day', dueDate: todayKey },
    onError: () => {
      setIndentError(true);
      refreshDaily();
    },
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

  const handleRightClick: TaskListContextMenuHandler = useCallback(
    (id, position, visibleTasks, scope) => {
      setSelectedId(id);
      setContextMenu({ taskId: id, position, visibleTasks, scope });
    },
    [setSelectedId],
  );

  const handleAssignCollection = useCallback(
    (taskId: string, collectionId: string) => {
      setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, collectionId } : t)));
      apiUpdateTask(taskId, { collectionId }).catch(() => refreshDaily());
    },
    [refreshDaily, setAllTasks],
  );

  const handleMoveStatus = useCallback(
    (task: Task, statusId: string | null) => {
      if (!task.collectionId || task.parentTaskId) return;
      apiMoveTask(task.id, {
        parentTaskId: null,
        collectionId: task.collectionId,
        statusId,
        scope: { kind: 'status', collectionId: task.collectionId, statusId },
        position: Number.MAX_SAFE_INTEGER,
      })
        .then(() => {
          refreshDaily();
          qc.invalidateQueries({ queryKey: ['collection', task.collectionId] });
        })
        .catch(() => refreshDaily());
    },
    [qc, refreshDaily],
  );

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
    () =>
      listDays({
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
        if (
          (event.target as HTMLElement).closest(
            'input, [contenteditable], button, [role="button"], [data-task-id], [data-card-id]',
          )
        ) {
          return;
        }
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
        afterTitle={
          <DailyReorganizeConfirm
            isVisible={reorg.state === 'preview'}
            onConfirm={reorg.confirmReorganize}
            onCancel={reorg.cancelReorganize}
          />
        }
      />

      <DailyPageContextMenu
        position={pageContextMenu}
        layout={layout}
        view={view}
        hideCompletedTasks={prefs?.hideCompletedTasks ?? false}
        showNotes={prefs?.showNotes ?? true}
        onClose={() => setPageContextMenu(null)}
        onSetHideCompletedTasks={setHideCompletedTasks}
        onSetShowNotes={setShowNotes}
      />

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
      )}

      {indentError && (
        <div role="alert" className="text-accent text-sm mt-6">
          {t('task.moveFailed')}
        </div>
      )}
      <DailyTaskContextMenu
        contextMenu={contextMenu}
        menuTask={menuTask}
        statuses={menuCollection?.statuses ?? []}
        completionStatusId={menuCollection?.completionStatusId ?? null}
        collections={collections}
        onClose={() => setContextMenu(null)}
        onToggle={handleToggle}
        onMoveStatus={handleMoveStatus}
        onSetSchedule={handleSetSchedule}
        onAssignCollection={handleAssignCollection}
        onAddAbove={handleAddAbove}
        onAddBelow={handleAddBelow}
        onIndent={handleIndent}
        onDelete={handleDelete}
      />
    </div>
  );
}
