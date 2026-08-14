import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  apiCreateStatus,
  apiSetCollectionCompletionStatus,
  apiSeedStatuses,
  apiUpdateSection,
  apiUpdateStatus,
  type ApiSection,
  type ApiStatus,
  type ApiTask,
  type BoardGroupBy,
  type BoardOrder,
} from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { buildColumns } from '../../utils/boardColumns';
import { useBoardColumnDrag } from '../../hooks/useBoardColumnDrag';
import { useBoardDrag } from '../../hooks/useBoardDrag';
import { ConfirmModal } from '../ConfirmModal';
import { ColumnDeleteModal } from './ColumnDeleteModal';
import { BoardView } from './BoardView';

interface CollectionBoardProps {
  collectionId: string;
  queryKey: readonly unknown[];
  groupBy: BoardGroupBy;
  tasks: ApiTask[];
  statuses: ApiStatus[];
  completionStatusId: string | null;
  sections: ApiSection[];
  boardOrder: BoardOrder;
  onToggle?: (taskId: string, completed: boolean) => void;
}

export function CollectionBoard(props: CollectionBoardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const seedRequested = useRef(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingCompletionColumnId, setPendingCompletionColumnId] = useState<string | null>(null);
  const [boardTasks, setBoardTasks] = useState(props.tasks);
  const [boardOrder, setBoardOrder] = useState(props.boardOrder);
  const [completionStatusId, setCompletionStatusId] = useState(props.completionStatusId);

  useEffect(() => setBoardTasks(props.tasks), [props.tasks]);
  useEffect(() => setBoardOrder(props.boardOrder), [props.boardOrder]);
  useEffect(() => setCompletionStatusId(props.completionStatusId), [props.completionStatusId]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: props.queryKey }),
    [props.queryKey, queryClient],
  );

  useEffect(() => {
    if (props.groupBy !== 'status' || seedRequested.current) return;
    seedRequested.current = true;
    apiSeedStatuses(props.collectionId)
      .then(() => queryClient.invalidateQueries({ queryKey: props.queryKey }))
      .catch(() => {
        seedRequested.current = false;
      });
  }, [props.collectionId, props.groupBy, props.queryKey, props.statuses.length, queryClient]);

  const projectedColumns = useMemo(() => buildColumns({
    groupBy: props.groupBy,
    tasks: boardTasks,
    statuses: props.statuses,
    completionStatusId,
    sections: props.sections,
    boardOrder,
    noSectionTitle: t('board.noSection'),
    priorityTitle: (priority) => t('board.priority', { priority }),
  }), [boardOrder, boardTasks, completionStatusId, props.groupBy, props.sections, props.statuses, t]);
  const [columns, setColumns] = useState(projectedColumns);
  useEffect(() => setColumns(projectedColumns), [projectedColumns]);

  const columnDrag = useBoardColumnDrag({
    collectionId: props.collectionId,
    groupBy: props.groupBy,
    columns,
    setColumns,
    statuses: props.statuses,
    sections: props.sections,
    onError: invalidate,
    deleteMessage: (groupBy, taskCount) => taskCount === 0
      ? t('board.deleteColumnEmptyMessage')
      : groupBy === 'section'
        ? t('board.deleteSectionColumnMessage', { count: String(taskCount) })
        : t('board.deleteStatusColumnMessage', { count: String(taskCount) }),
  });

  useBoardDrag({
    tasks: boardTasks,
    boardOrder,
    groupBy: props.groupBy,
    collectionId: props.collectionId,
    statuses: props.statuses,
    sections: props.sections,
    completionStatusId,
    setTasks: setBoardTasks,
    setBoardOrder,
    onError: invalidate,
    onMoved: invalidate,
  });

  const reportError = useCallback((error: unknown) => {
    setBoardError(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : t('board.columnUpdateError'),
    );
  }, [t]);

  const handleAddColumn = useCallback((name: string) => {
    setBoardError(null);
    apiCreateStatus(props.collectionId, { name })
      .then((status) => {
        setColumns((current) => [
          ...current,
          {
            id: `status:${status.id}`,
            value: status.id,
            title: status.name,
            color: status.color,
            isCompletionStatus: false,
            tasks: [],
          },
        ]);
        invalidate();
      })
      .catch(reportError);
  }, [invalidate, props.collectionId, reportError]);

  const handleRenameColumn = useCallback((columnId: string, name: string) => {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column || typeof column.value !== 'string') return;
    const before = columns;
    setBoardError(null);
    setColumns((current) => current.map((candidate) => (
      candidate.id === columnId ? { ...candidate, title: name } : candidate
    )));
    const request = props.groupBy === 'status'
      ? apiUpdateStatus(column.value, { name })
      : apiUpdateSection(column.value, { name });
    request.then(invalidate).catch((error) => {
      setColumns(before);
      reportError(error);
    });
  }, [columns, invalidate, props.groupBy, reportError]);

  const handleRecolorColumn = useCallback((columnId: string, color: string) => {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column || typeof column.value !== 'string' || props.groupBy !== 'status') return;
    const before = columns;
    setBoardError(null);
    setColumns((current) => current.map((candidate) => (
      candidate.id === columnId ? { ...candidate, color } : candidate
    )));
    apiUpdateStatus(column.value, { color }).then(invalidate).catch((error) => {
      setColumns(before);
      reportError(error);
    });
  }, [columns, invalidate, props.groupBy, reportError]);

  const markCompletion = useCallback((columnId: string) => {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column || typeof column.value !== 'string') return;
    const statusId = column.value;
    setBoardError(null);
    apiSetCollectionCompletionStatus(props.collectionId, statusId)
      .then(() => {
        setColumns((current) => current.map((candidate) => ({
          ...candidate,
          isCompletionStatus: candidate.id === columnId,
        })));
        setCompletionStatusId(statusId);
        setPendingCompletionColumnId(null);
        invalidate();
      })
      .catch(reportError);
  }, [columns, invalidate, props.collectionId, reportError]);

  const handleMarkCompletion = useCallback((columnId: string) => {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column) return;
    if (column.tasks.length > 0) {
      setPendingCompletionColumnId(columnId);
      return;
    }
    markCompletion(columnId);
  }, [columns, markCompletion]);

  const pendingCompletionColumn = columns.find((column) => column.id === pendingCompletionColumnId);

  if (props.groupBy === 'status' && props.statuses.length === 0) {
    return <div className="board-loading">{t('board.preparing')}</div>;
  }

  return (
    <>
      {boardError && <div role="alert" className="board-error">{boardError}</div>}
      <BoardView
        collectionId={props.collectionId}
        groupBy={props.groupBy}
        columns={columns}
        tasks={boardTasks}
        canAddColumn={props.groupBy === 'status'}
        onToggle={(taskId, completed) => {
          setBoardTasks((current) => current.map((task) => (
            task.id === taskId ? { ...task, isCompleted: completed } : task
          )));
          props.onToggle?.(taskId, completed);
        }}
        onAddColumn={handleAddColumn}
        onRenameColumn={handleRenameColumn}
        onRecolorColumn={handleRecolorColumn}
        onMarkCompletion={handleMarkCompletion}
        onDeleteColumn={columnDrag.openDeleteColumn}
      />
      {columnDrag.deleteModal && <ColumnDeleteModal {...columnDrag.deleteModal} />}
      <ConfirmModal
        isOpen={!!pendingCompletionColumn}
        title={t('board.markCompletion')}
        message={t('board.markCompletionMessage', { name: pendingCompletionColumn?.title ?? '' })}
        confirmLabel={t('common.confirm')}
        onConfirm={() => pendingCompletionColumnId && markCompletion(pendingCompletionColumnId)}
        onCancel={() => setPendingCompletionColumnId(null)}
      />
    </>
  );
}
