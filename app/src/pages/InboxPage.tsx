import { Fragment, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PlaceholderBullet } from '../components/ui/PlaceholderBullet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskList } from '../components/TaskList';
import { SectionHeader } from '../components/SectionHeader';
import { InlineNameInput } from '../components/ui/InlineNameInput';
import { EditableText } from '../components/ui/EditableText';
import { CollectionBoard } from '../components/board/CollectionBoard';
import { BoardPageToolbar } from '../components/board/BoardPageToolbar';
import { MonthlyView } from '../components/monthly/MonthlyView';
import { PageHeader } from '../components/PageHeader';
import { fetchInboxTasks, fetchCollectionView, apiMoveTask, fetchCollections } from '../api/client';
import { ContextMenu } from '../components/ui/ContextMenu';
import { SectionDeleteModal } from '../components/SectionDeleteModal';
import { Folder, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useSectionDrag } from '../hooks/useSectionDrag';
import { usePreferences } from '../hooks/usePreferences';
import { useBoardPreferences } from '../hooks/useBoardPreferences';
import { buildIndentMenuItems } from '../components/taskIndentMenu';
import type { TaskIndentMenuContext, TaskListContextMenuHandler } from '../types/taskIndent';
import { useSync } from '../hooks/useSync';
import { isEchoedMove } from '../utils/moveEcho';
import { useI18n } from '../i18n/I18nContext';
import { buildSetDateMenuItem } from '../components/taskDateMenuItem';
import type { StoreSection, Task } from '../types/task';
import { buildTaskMenuActions } from '../utils/taskMenuActions';
import { apiToTask, useInboxTaskRows } from '../hooks/useInboxTaskRows';
import { useInboxAdd } from '../hooks/useInboxAdd';
import { useInboxSections } from '../hooks/useInboxSections';
import { useCollectionSubmenu } from '../hooks/useCollectionSubmenu';


function buildSectionGroups(tasks: Task[], sections: StoreSection[]) {
  const groups: Array<{ section: StoreSection | null; tasks: Task[] }> = [];

  groups.push({
    section: null,
    tasks: tasks.filter((t) => !t.sectionId) });

  for (const section of [...sections].sort((a, b) => a.orderValue - b.orderValue)) {
    groups.push({
      section,
      tasks: tasks.filter((t) => t.sectionId === section.id) });
  }

  return groups;
}

export function InboxPage() {
  const { locale, t } = useI18n();
  const qc = useQueryClient();
  const cachedInbox = qc.getQueryData<Awaited<ReturnType<typeof fetchInboxTasks>>>(['inbox']);
  const [tasks, setTasks] = useState<Task[]>(() => cachedInbox?.tasks.map(apiToTask) ?? []);
  const [sections, setSections] = useState<StoreSection[]>(() => cachedInbox?.sections ?? []);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTaskInput, setSectionTaskInput] = useState<Record<string, string>>({});
  const [, setSelectedId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<TaskIndentMenuContext | null>(null);
  const [indentError, setIndentError] = useState(false);
  const [sectionContextMenu, setSectionContextMenu] = useState<{ sectionId: string; position: { x: number; y: number } } | null>(null);
  const [deletingSection, setDeletingSection] = useState<{ id: string; name: string; taskCount: number } | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: preferences } = usePreferences();
  // The board settings are keyed by the Inbox collection, known from the collection list before the view loads.
  const { data: allCollections } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const [knownInboxId, setKnownInboxId] = useState(cachedInbox?.inboxCollectionId);
  const inboxCollectionId = allCollections?.find((collection) => collection.isInbox)?.id ?? knownInboxId;
  const boardPreferences = useBoardPreferences(inboxCollectionId, preferences);
  const { includeCompleted } = boardPreferences;
  const inboxKey = useMemo(() => (includeCompleted ? ['inbox', 'with-completed'] : ['inbox']), [includeCompleted]);
  const { data } = useQuery({
    queryKey: inboxKey,
    queryFn: () => fetchInboxTasks({ includeCompleted }),
    staleTime: 30_000 });

  const [syncedData, setSyncedData] = useState(data);
  if (data !== syncedData) {
    setSyncedData(data);
    if (data?.inboxCollectionId && data.inboxCollectionId !== knownInboxId) setKnownInboxId(data.inboxCollectionId);
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
    if (data?.sections) {
      setSections(data.sections);
    }
  }

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['inbox'] }), [qc]);

  // Moves are addressed to the real Inbox collection, which the view resolves
  // for us rather than the client having to look it up.
  const { activeDragId } = useTaskDrag({
    enabled: boardPreferences.view === 'list',
    tasks,
    setTasks,
    scope: { kind: 'collection', collectionId: data?.collectionId ?? '' },
    onError: () => { setIndentError(true); invalidate(); },
    // A task can be dropped onto a sidebar collection and leave Inbox entirely.
    onMoved: () => qc.invalidateQueries({ queryKey: ['collection'] }) });

  useSectionDrag({ sections, setSections, onError: invalidate });

  useSync(useCallback((event) => {
    if (event.entityType === 'status') {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
      return;
    }
    if (event.entityType !== 'task') return;
    // Refetching mid-move would overwrite the optimistic state with the order the
    // server held before the request this session is still waiting on.
    if (isEchoedMove(event)) return;
    invalidate();
  }, [invalidate, qc]));

  const { handleAddAtEnd, handleAddSectionTask, handleAddNoteKeyDown } = useInboxAdd({
    input, setInput, setSectionTaskInput, setTasks, setEditingId, invalidate, locale });

  const {
    handleAddBelow, handleAddAbove, handleStartEdit, handleEditCommit, handleConvertType,
    handleEditCancel, handleSetSchedule, handleDelete, handleIndent, handleToggle } = useInboxTaskRows({
    tasks, tasksRef, setTasks, setEditingId, setSelectedId, setIndentError, invalidate, locale,
    hideCompletedTasks: preferences?.hideCompletedTasks ?? false, includeCompleted });

  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });
  const menuTask = tasks.find((task) => task.id === contextMenu?.taskId);
  const { data: menuCollection } = useQuery({
    queryKey: ['collection', menuTask?.collectionId],
    queryFn: () => fetchCollectionView(menuTask!.collectionId!),
    enabled: Boolean(contextMenu && menuTask?.collectionId && menuTask.collectionId !== data?.collectionId) });

  const handleRightClick: TaskListContextMenuHandler = useCallback((taskId, position, visibleTasks, scope) => {
    setSelectedId(taskId);
    setContextMenu({ taskId, position, visibleTasks, scope });
  }, []);

  const {
    handleSectionRightClick, handleAddSection, handleDeleteSection, handleCommitSectionName,
    handleCancelSectionEdit, handleConfirmDeleteSectionAndTasks, handleConfirmMoveTasksToTopLevel } = useInboxSections({
    inboxCollectionId, sections, setSections, tasks, setTasks, setEditingSectionId, setSectionContextMenu,
    deletingSection, setDeletingSection, invalidate });

  const projectSubmenuItems = useCollectionSubmenu(collections, contextMenu?.taskId, invalidate, t);

  // A section being named for the first time renders as an inline input in the
  // "+ New section" row itself, rather than up in the grouped list, so the
  // input appears exactly where the user clicked.
  const addingSection = sections.find((s) => s.id.startsWith('temp-'));
  const [topLevelGroup, ...sectionGroups] = buildSectionGroups(
    tasks,
    sections.filter((s) => !s.id.startsWith('temp-')),
  );
  // List view always groups by section, regardless of the Kanban groupBy
  // preference - status/priority grouping only applies to the Kanban board.

  return (
    <div
      className="inbox-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, [contenteditable], button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <PageHeader
        title={t('page.inbox')}
        actions={<BoardPageToolbar board={boardPreferences} />}
      />

      <div className={boardPreferences.view !== 'list' ? 'w-full' : undefined}>
        {boardPreferences.view !== 'list' && boardPreferences.view !== 'calendar' && data && inboxCollectionId ? (
          <CollectionBoard
            collectionId={inboxCollectionId}
            queryKey={inboxKey}
            groupBy={boardPreferences.groupBy}
            tasks={data.tasks}
            statuses={data.statuses}
            completionStatusId={data.completionStatusId}
            sections={data.sections}
            boardOrder={data.boardOrder}
            onToggle={(taskId) => handleToggle(taskId)}
              presentation={boardPreferences.view === 'kanban-list' ? 'kanban-list' : 'kanban'}
            taskListProps={{
              activeDragId,
              editingId,
              onStartEdit: handleStartEdit,
              onEditCommit: handleEditCommit,
              onEditCancel: handleEditCancel,
              onDelete: handleDelete,
              onAddBelow: handleAddBelow,
              onIndent: handleIndent,
              onConvertType: handleConvertType,
              onRightClick: handleRightClick }}
          />
        ) : boardPreferences.view === 'calendar' ? (
          <>
            <div className="h-6" />
            <MonthlyView tasks={tasks} onToggle={(taskId) => handleToggle(taskId)} onTaskContextMenu={handleRightClick} />
          </>
        ) : (
          <>
            <div className="h-6" />

            <TaskList
              tasks={topLevelGroup.tasks}
              containerId="collection:inbox"
              activeDragId={activeDragId}
              editingId={editingId}
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

            <div className="flex items-start min-h-6">
              <PlaceholderBullet />
              <EditableText
                ref={inputRef}
                value={input}
                onValueChange={setInput}
                onEnter={handleAddAtEnd}
                onBlur={() => handleAddAtEnd(input)}
                onKeyDown={handleAddNoteKeyDown}
                placeholder={t('common.addTask')}
                aria-label={t('common.addTask')}
                className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
                spellCheck={false}
              />
            </div>

            <SortableContext
                items={sectionGroups.map((group) => group.section!.id)}
                strategy={verticalListSortingStrategy}
              >
                {sectionGroups.map((group) => (
                  <Fragment key={group.section!.id}>
                    <div className="h-6" />
                    <SectionHeader
                      section={group.section!}
                      collectionId={inboxCollectionId ?? ''}
                      isEditing={editingSectionId === group.section!.id}
                      onEdit={() => setEditingSectionId(group.section!.id)}
                      onCommitName={(name) => handleCommitSectionName(group.section!.id, name)}
                      onCancelEdit={() => handleCancelSectionEdit(group.section!.id)}
                      onDelete={() => handleDeleteSection(group.section!.id)}
                      onRightClick={(position) => handleSectionRightClick(group.section!.id, position)}
                    />
                    <TaskList
                      tasks={group.tasks}
                      containerId={`section:${group.section!.id}`}
                      sectionId={group.section!.id}
                      collectionId={inboxCollectionId}
                      activeDragId={activeDragId}
                      editingId={editingId}
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
                    <div className="flex items-start min-h-6">
                      <PlaceholderBullet />
                      <EditableText
                        value={sectionTaskInput[group.section!.id] ?? ''}
                        onValueChange={(text) => setSectionTaskInput((prev) => ({ ...prev, [group.section!.id]: text }))}
                        onEnter={(text) => handleAddSectionTask(group.section!.id, text)}
                        onBlur={() => handleAddSectionTask(group.section!.id, sectionTaskInput[group.section!.id] ?? '')}
                        placeholder={t('common.addTask')}
                        aria-label={t('common.addTask')}
                        className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
                        spellCheck={false}
                      />
                    </div>
                  </Fragment>
                ))}
              </SortableContext>

              <div className="h-6" />

              {addingSection ? (
                <div className="flex h-6 w-full min-w-0 items-center pr-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-light opacity-35">+</span>
                  <InlineNameInput
                    defaultValue=""
                    placeholder={t('page.newSection')}
                    className="uppercase tracking-widest text-[10px] font-semibold text-ink-light"
                    onCommit={(name) => handleCommitSectionName(addingSection.id, name)}
                    onCancel={() => handleCancelSectionEdit(addingSection.id)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="group flex h-6 w-full min-w-0 items-center pr-2 text-ink-light opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">+</span>
                  <span className="min-w-0 flex-1 truncate text-left uppercase tracking-widest text-[10px] font-semibold">
                    {t('page.newSection')}
                  </span>
                </button>
              )}
          </>
        )}
      </div>

      {indentError && <div role="alert" className="text-danger-text text-sm mt-6">{t('task.moveFailed')}</div>}
      {contextMenu && (
        <ContextMenu
          caret
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            ...buildTaskMenuActions({
              task: menuTask,
              statuses: menuCollection?.statuses ?? data?.statuses ?? [],
              completionStatusId: menuCollection?.completionStatusId ?? data?.completionStatusId ?? null,
              t,
              onToggle: () => handleToggle(contextMenu.taskId),
              onMove: (statusId) => {
                if (!menuTask?.collectionId || menuTask.parentTaskId) return;
                apiMoveTask(menuTask.id, { parentTaskId: null, collectionId: menuTask.collectionId, statusId, scope: { kind: 'status', collectionId: menuTask.collectionId, statusId }, position: Number.MAX_SAFE_INTEGER })
                  .then(() => { invalidate(); qc.invalidateQueries({ queryKey: ['collection', menuTask.collectionId] }); })
                  .catch(invalidate);
              } }),
            // { type: 'item', label: 'Date', icon: <Calendar size={14} />, disabled: true },
            // { type: 'item', label: 'Priority', icon: <Tag size={14} />, disabled: true },
            buildSetDateMenuItem(t, tasks.find((task) => task.id === contextMenu.taskId), handleSetSchedule),
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

      {sectionContextMenu && (
        <ContextMenu
          position={sectionContextMenu.position}
          onClose={() => setSectionContextMenu(null)}
          items={[
            { type: 'item', label: t('common.rename'), icon: <Pencil size={14} />, onClick: () => setEditingSectionId(sectionContextMenu.sectionId) },
            { type: 'separator' },
            { type: 'item', label: t('common.delete'), icon: <Trash2 size={14} />, destructive: true, onClick: () => handleDeleteSection(sectionContextMenu.sectionId) },
          ]}
        />
      )}

      <SectionDeleteModal
        isOpen={deletingSection !== null}
        sectionName={deletingSection?.name ?? ''}
        taskCount={deletingSection?.taskCount ?? 0}
        onDeleteTasks={handleConfirmDeleteSectionAndTasks}
        onMoveToTopLevel={handleConfirmMoveTasksToTopLevel}
        onCancel={() => setDeletingSection(null)}
      />
    </div>
  );
}
