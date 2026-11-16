import { Fragment, useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { PlaceholderBullet } from '../components/ui/PlaceholderBullet';
import { useParams } from 'react-router';
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
import {
  CollectionBreadcrumbOverlays,
  CollectionBreadcrumbTitle,
  CollectionSubInput,
} from '../components/collections/CollectionBreadcrumbs';
import { fetchCollectionView, fetchCollections, apiUpdateTask, apiMoveTask } from '../api/client';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useSectionDrag } from '../hooks/useSectionDrag';
import { usePreferences } from '../hooks/usePreferences';
import { useBoardPreferences } from '../hooks/useBoardPreferences';
import { useCollectionBreadcrumbs } from '../hooks/useCollectionBreadcrumbs';
import { useCollectionSections } from '../hooks/useCollectionSections';
import { apiToTask, useCollectionTasks } from '../hooks/useCollectionTasks';
import { buildIndentMenuItems } from '../components/taskIndentMenu';
import type { TaskIndentMenuContext, TaskListContextMenuHandler } from '../types/taskIndent';
import { ContextMenu } from '../components/ui/ContextMenu';
import type { ContextMenuItem } from '../types/contextMenu';
import { SectionDeleteModal } from '../components/SectionDeleteModal';
import { flattenCollections } from '../utils/collectionTree';
import { Folder, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { buildSetDateMenuItem } from '../components/taskDateMenuItem';
import type { StoreSection, Task } from '../types/task';
import { buildTaskMenuActions } from '../utils/taskMenuActions';
import { useSync } from '../hooks/useSync';

export function CollectionsPage() {
  const { locale, t } = useI18n();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [contextMenu, setContextMenu] = useState<TaskIndentMenuContext | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [id]);

  const { data: preferences } = usePreferences();
  const boardPreferences = useBoardPreferences(id, preferences);
  const { includeCompleted } = boardPreferences;
  // Same prefix as every ['collection', id] invalidation; the suffix keeps the two task sets apart.
  const viewKey = useMemo(
    () => (includeCompleted ? ['collection', id, 'with-completed'] : ['collection', id]),
    [id, includeCompleted],
  );
  const { data } = useQuery({
    queryKey: viewKey,
    queryFn: () => fetchCollectionView(id, { includeCompleted }),
    staleTime: 30_000,
    enabled: !!id,
  });
  useSync(
    useCallback(
      (event) => {
        if (event.entityType === 'status' && event.collectionId === id) {
          qc.invalidateQueries({ queryKey: ['collection', id] });
        }
      },
      [id, qc],
    ),
  );

  useLayoutEffect(() => {
    if (data?.tasks) {
      setTasks(data.tasks.map(apiToTask));
    }
  }, [data]);

  useLayoutEffect(() => {
    if (data?.sections) {
      setSections(data.sections);
    }
  }, [data]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['collection', id] }),
    [qc, id],
  );

  const {
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
  } = useCollectionTasks({
    id,
    locale,
    tasks,
    setTasks,
    hideCompletedTasks: preferences?.hideCompletedTasks ?? false,
    includeCompleted,
    invalidate,
  });

  const { activeDragId } = useTaskDrag({
    enabled: boardPreferences.view === 'list',
    tasks,
    setTasks,
    scope: { kind: 'collection', collectionId: id },
    onError: () => {
      setIndentError(true);
      invalidate();
    },
    // A task can be dropped onto Inbox or another collection in the sidebar.
    onMoved: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  useSectionDrag({ sections, setSections, onError: invalidate });

  const {
    editingSectionId,
    setEditingSectionId,
    sectionContextMenu,
    setSectionContextMenu,
    deletingSection,
    setDeletingSection,
    addingSection,
    topLevelGroup,
    sectionGroups,
    handleSectionRightClick,
    handleAddSection,
    handleDeleteSection,
    handleCommitSectionName,
    handleCancelSectionEdit,
    handleConfirmDeleteSectionAndTasks,
    handleConfirmMoveTasksToTopLevel,
  } = useCollectionSections({
    id,
    tasks,
    setTasks,
    sections,
    setSections,
    invalidate,
  });

  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const breadcrumbs = useCollectionBreadcrumbs(id, collections, data?.collection);

  const handleRightClick: TaskListContextMenuHandler = useCallback(
    (taskId, position, visibleTasks, scope) => {
      setSelectedId(taskId);
      setContextMenu({ taskId, position, visibleTasks, scope });
    },
    [setSelectedId],
  );

  const projectSubmenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = flattenCollections(collections).map((c) => ({
      type: 'item',
      label: c.name,
      icon: (
        <span
          className="w-1.75 h-1.75 rounded-full inline-block filter-[saturate(0.55)]"
          style={{ backgroundColor: c.color, marginLeft: c.depth * 12 }}
        />
      ),
      onClick: () => {
        if (contextMenu?.taskId) {
          apiUpdateTask(contextMenu.taskId, { collectionId: c.id }).catch(() => invalidate());
        }
      },
    }));

    items.push({
      type: 'item',
      label: t('contextMenu.noCollection'),
      icon: <span className="w-1.75 h-1.75 rounded-full inline-block bg-transparent border border-ink/20" />,
      onClick: () => {
        if (contextMenu?.taskId) {
          const inbox = collections.find((c) => c.isInbox);
          if (inbox) {
            apiUpdateTask(contextMenu.taskId, { collectionId: inbox.id }).catch(() => invalidate());
          }
        }
      },
    });

    return items;
  }, [collections, contextMenu, invalidate, t]);

  return (
    <div
      className="collection-detail-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, [contenteditable], button, [role="button"]')) return;
        inputRef.current?.focus();
      }}
    >
      <PageHeader
        titleClassName="collections-page-title flex items-center gap-2"
        title={
          <CollectionBreadcrumbTitle
            trail={breadcrumbs.trail}
            renamingCrumbId={breadcrumbs.renamingCrumbId}
            crumbDraft={breadcrumbs.crumbDraft}
            onDraftChange={breadcrumbs.setCrumbDraft}
            onCommitRename={breadcrumbs.handleCrumbRename}
            onCancelRename={() => breadcrumbs.setRenamingCrumbId(null)}
            onOpenMenu={breadcrumbs.setCrumbMenu}
          />
        }
        afterTitle={
          <CollectionSubInput
            isOpen={breadcrumbs.subAddingParentId !== null}
            value={breadcrumbs.subNewName}
            onChange={breadcrumbs.setSubNewName}
            onCommit={breadcrumbs.handleCrumbCommitSub}
            onCancel={breadcrumbs.handleCancelSub}
          />
        }
        actions={<BoardPageToolbar board={boardPreferences} />}
      />

      <div className={boardPreferences.view !== 'list' ? 'w-full' : undefined}>
        {boardPreferences.view !== 'list' && boardPreferences.view !== 'calendar' && data ? (
          <CollectionBoard
            collectionId={id}
            queryKey={viewKey}
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
              onRightClick: handleRightClick,
            }}
          />
        ) : boardPreferences.view === 'calendar' ? (
          <>
            <div className="h-6" />
            <MonthlyView
              tasks={tasks}
              onToggle={(taskId) => handleToggle(taskId)}
              onTaskContextMenu={handleRightClick}
            />
          </>
        ) : (
          <>
            <div className="h-6" />

            <TaskList
              tasks={topLevelGroup.tasks}
              containerId={`collection:${id}`}
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
                className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
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
                    collectionId={id ?? ''}
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
                    collectionId={id}
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
                      onValueChange={(text) =>
                        setSectionTaskInput((prev) => ({ ...prev, [group.section!.id]: text }))
                      }
                      onEnter={(text) => handleAddSectionTask(group.section!.id, text)}
                      onBlur={() =>
                        handleAddSectionTask(group.section!.id, sectionTaskInput[group.section!.id] ?? '')
                      }
                      placeholder={t('common.addTask')}
                      aria-label={t('common.addTask')}
                      className="task-input task-add-input flex-1 text-sm leading-6 text-ink bg-transparent border-none outline-none p-0"
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

      {indentError && (
        <div role="alert" className="text-danger-text text-sm mt-6">
          {t('task.moveFailed')}
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          caret
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          items={[
            ...buildTaskMenuActions({
              task: tasks.find((task) => task.id === contextMenu.taskId),
              statuses: data?.statuses ?? [],
              completionStatusId: data?.completionStatusId ?? null,
              t,
              onToggle: () => handleToggle(contextMenu.taskId),
              onMove: (statusId) => {
                const task = tasks.find((candidate) => candidate.id === contextMenu.taskId);
                if (!task || task.parentTaskId) return;
                apiMoveTask(task.id, {
                  parentTaskId: null,
                  collectionId: id,
                  statusId,
                  scope: { kind: 'status', collectionId: id, statusId },
                  position: Number.MAX_SAFE_INTEGER,
                })
                  .then(invalidate)
                  .catch(invalidate);
              },
            }),
            buildSetDateMenuItem(t, tasks.find((task) => task.id === contextMenu.taskId), handleSetSchedule),
            { type: 'item', label: t('contextMenu.collection'), icon: <Folder size={14} />, submenu: projectSubmenuItems },
            { type: 'separator' },
            {
              type: 'item',
              label: t('contextMenu.addAbove'),
              icon: <ArrowUp size={14} />,
              onClick: () => handleAddAbove(contextMenu.taskId),
            },
            {
              type: 'item',
              label: t('contextMenu.addBelow'),
              icon: <ArrowDown size={14} />,
              onClick: () => handleAddBelow(contextMenu.taskId),
            },
            ...buildIndentMenuItems(t, contextMenu, handleIndent),
            { type: 'separator' },
            {
              type: 'item',
              label: t('common.delete'),
              icon: <Trash2 size={14} />,
              destructive: true,
              onClick: () => handleDelete(contextMenu.taskId),
            },
          ]}
        />
      )}

      {sectionContextMenu && (
        <ContextMenu
          position={sectionContextMenu.position}
          onClose={() => setSectionContextMenu(null)}
          items={[
            {
              type: 'item',
              label: t('common.rename'),
              icon: <Pencil size={14} />,
              onClick: () => setEditingSectionId(sectionContextMenu.sectionId),
            },
            { type: 'separator' },
            {
              type: 'item',
              label: t('common.delete'),
              icon: <Trash2 size={14} />,
              destructive: true,
              onClick: () => handleDeleteSection(sectionContextMenu.sectionId),
            },
          ]}
        />
      )}

      <CollectionBreadcrumbOverlays
        trail={breadcrumbs.trail}
        crumbMenu={breadcrumbs.crumbMenu}
        onCloseMenu={() => breadcrumbs.setCrumbMenu(null)}
        onOpenColorPicker={breadcrumbs.setCrumbColorPicker}
        onStartRename={(collectionId, currentName) => {
          breadcrumbs.setCrumbDraft(currentName);
          breadcrumbs.setRenamingCrumbId(collectionId);
        }}
        onStartAddSub={(collectionId) => {
          breadcrumbs.setSubNewName('');
          breadcrumbs.setSubAddingParentId(collectionId);
        }}
        onRequestDelete={breadcrumbs.setDeletingCollection}
        crumbColorPicker={breadcrumbs.crumbColorPicker}
        onCommitColor={breadcrumbs.handleCrumbColorCommit}
        onCloseColorPicker={() => breadcrumbs.setCrumbColorPicker(null)}
        deletingCollection={breadcrumbs.deletingCollection}
        onConfirmDelete={breadcrumbs.handleConfirmDeleteCollection}
        onCancelDelete={() => breadcrumbs.setDeletingCollection(null)}
      />

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
