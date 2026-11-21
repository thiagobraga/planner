import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CollectionTaskList } from '../components/collections/CollectionTaskList';
import { CollectionBoard } from '../components/board/CollectionBoard';
import { BoardPageToolbar } from '../components/board/BoardPageToolbar';
import { MonthlyView } from '../components/monthly/MonthlyView';
import { PageHeader } from '../components/PageHeader';
import {
  CollectionBreadcrumbOverlays,
  CollectionBreadcrumbTitle,
  CollectionHeaderActions,
  CollectionSubInput,
} from '../components/collections/CollectionBreadcrumbs';
import { CollectionContextMenus } from '../components/collections/CollectionContextMenus';
import { useCollectionDeleted, useCollectionSplit } from '../contexts/CollectionSplitContext';
import { fetchCollections } from '../api/client';
import { useTaskDrag } from '../hooks/useTaskDrag';
import { useSectionDrag } from '../hooks/useSectionDrag';
import { usePreferences } from '../hooks/usePreferences';
import { useBoardPreferences } from '../hooks/useBoardPreferences';
import { useCollectionBreadcrumbs } from '../hooks/useCollectionBreadcrumbs';
import { useCollectionSections } from '../hooks/useCollectionSections';
import { apiToTask, useCollectionTasks } from '../hooks/useCollectionTasks';
import type { TaskIndentMenuContext, TaskListContextMenuHandler } from '../types/taskIndent';
import { SectionDeleteModal } from '../components/SectionDeleteModal';
import { useI18n } from '../i18n/I18nContext';
import type { StoreSection, Task } from '../types/task';
import { isCollectionUnavailable, useCollectionView } from '../hooks/useCollectionView';
import { CollectionLoadState, CollectionNotFound } from '../components/collections/CollectionViewState';
import { isDesktopCollections } from '../utils/collectionsLayout';

const INTERACTIVE_TARGET = 'input, [contenteditable], button, a, select, [role="button"], [role="dialog"], [role="menu"], [role="slider"]';

export function CollectionsPage({
  collectionId,
  onClosePane,
  isSecondaryPane = false,
  onNavigateCollection,
}: {
  collectionId?: string;
  onClosePane?: () => void;
  isSecondaryPane?: boolean;
  onNavigateCollection?: (targetId: string) => void;
} = {}) {
  const { locale, t } = useI18n();
  const params = useParams();
  const id = collectionId ?? params.id ?? '';
  const onSplit = useCollectionSplit();
  const onCollectionDeleted = useCollectionDeleted();
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [contextMenu, setContextMenu] = useState<TaskIndentMenuContext | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const { data: preferences, isPending: preferencesPending } = usePreferences();
  const boardPreferences = useBoardPreferences(id, preferences);
  const { includeCompleted } = boardPreferences;
  // includeCompleted depends on preferences; fetching earlier would load the view twice.
  const { data, error, isError, refetch, viewKey } = useCollectionView(id, includeCompleted, !preferencesPending);

  const ready = !!data;
  useEffect(() => {
    if (ready && !isSecondaryPane && !isDesktopCollections()) inputRef.current?.focus();
  }, [id, ready, isSecondaryPane]);

  useLayoutEffect(() => {
    if (data?.tasks) setTasks(data.tasks.map(apiToTask));
  }, [data]);

  useLayoutEffect(() => {
    if (data?.sections) setSections(data.sections);
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
    enabled: !isSecondaryPane && boardPreferences.view === 'list',
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

  const breadcrumbs = useCollectionBreadcrumbs(id, collections, data?.collection, {
    onNavigateCollection,
    onCollectionDeleted,
  });

  const handleRightClick: TaskListContextMenuHandler = useCallback(
    (taskId, position, visibleTasks, scope) => {
      setSelectedId(taskId);
      setContextMenu({ taskId, position, visibleTasks, scope });
    },
    [setSelectedId],
  );

  const taskListProps = {
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
  };

  if (isCollectionUnavailable(error)) return <CollectionNotFound />;
  if (!data) return <CollectionLoadState failed={isError} onRetry={() => void refetch()} />;

  const titleAriaLabel = breadcrumbs.trail.map((crumb) => crumb.name).join(' ') || undefined;

  return (
    <div
      className="collection-detail-page relative w-full cursor-text"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(INTERACTIVE_TARGET)) return;
        inputRef.current?.focus();
      }}
    >
      <PageHeader
        titleClassName="collections-page-title flex items-center gap-2"
        titleAriaLabel={titleAriaLabel}
        title={
          <CollectionBreadcrumbTitle
            trail={breadcrumbs.trail}
            renamingCrumbId={breadcrumbs.renamingCrumbId}
            crumbDraft={breadcrumbs.crumbDraft}
            onDraftChange={breadcrumbs.setCrumbDraft}
            onCommitRename={breadcrumbs.handleCrumbRename}
            onCancelRename={() => breadcrumbs.setRenamingCrumbId(null)}
            onOpenMenu={breadcrumbs.setCrumbMenu}
            onToggleColorPicker={breadcrumbs.toggleCrumbColorPicker}
            colorPickerCollectionId={breadcrumbs.crumbColorPicker?.collectionId ?? null}
            onToggleChildrenMenu={breadcrumbs.toggleChildrenMenu}
            childrenMenuOpen={breadcrumbs.childrenMenu !== null}
            onNavigateAncestor={onNavigateCollection}
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
        actions={
          <CollectionHeaderActions
            toolbar={<BoardPageToolbar board={boardPreferences} registerShortcuts={!isSecondaryPane} />}
            onClosePane={onClosePane}
          />
        }
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
            taskListProps={taskListProps}
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
          <CollectionTaskList
            collectionId={id}
            inputRef={inputRef}
            taskListProps={taskListProps}
            onTaskToggle={handleToggle}
            topLevelGroup={topLevelGroup}
            input={{
              input, setInput, sectionTaskInput, setSectionTaskInput,
              handleAddAtEnd, handleAddSectionTask, handleAddNoteKeyDown,
            }}
            sections={{
              sectionGroups, editingSectionId, addingSection, setEditingSectionId,
              handleAddSection, handleDeleteSection, handleCommitSectionName,
              handleCancelSectionEdit, handleSectionRightClick,
            }}
          />
        )}
      </div>

      {indentError && (
        <div role="alert" className="text-danger-text text-sm mt-6">
          {t('task.moveFailed')}
        </div>
      )}

      <CollectionContextMenus
        collectionId={id}
        collections={collections}
        tasks={tasks}
        statuses={data?.statuses ?? []}
        completionStatusId={data?.completionStatusId ?? null}
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        sectionContextMenu={sectionContextMenu}
        onCloseSectionContextMenu={() => setSectionContextMenu(null)}
        onToggleTask={handleToggle}
        onSetSchedule={handleSetSchedule}
        onAddAbove={handleAddAbove}
        onAddBelow={handleAddBelow}
        onIndent={handleIndent}
        onDeleteTask={handleDelete}
        onEditSection={setEditingSectionId}
        onDeleteSection={handleDeleteSection}
        onInvalidate={invalidate}
      />

      <CollectionBreadcrumbOverlays
        trail={breadcrumbs.trail}
        currentCollectionId={id}
        childCollections={breadcrumbs.childCollections}
        childrenMenu={breadcrumbs.childrenMenu}
        onCloseChildrenMenu={() => breadcrumbs.setChildrenMenu(null)}
        onNavigateCollection={breadcrumbs.navigateToCollection}
        crumbMenu={breadcrumbs.crumbMenu}
        onCloseMenu={() => breadcrumbs.setCrumbMenu(null)}
        onOpenColorPicker={breadcrumbs.setCrumbColorPicker}
        onStartRename={(targetId, currentName) => {
          breadcrumbs.setCrumbDraft(currentName);
          breadcrumbs.setRenamingCrumbId(targetId);
        }}
        onStartAddSub={(targetId) => {
          breadcrumbs.setSubNewName('');
          breadcrumbs.setSubAddingParentId(targetId);
        }}
        onSplit={onSplit}
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
