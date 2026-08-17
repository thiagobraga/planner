import { useCallback, useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  apiDeleteSection,
  apiDeleteStatus,
  apiUpdateSection,
  apiUpdateStatus,
  ApiError,
} from '../api/client';
import { usePlannerDragHandlers } from '../contexts/usePlannerDrag';
import type { ApiSection, ApiStatus, BoardGroupBy } from '../api/client';
import type { BoardColumn as BoardColumnModel } from '../utils/boardColumns';
import type { BoardColumnDragData, BoardColumnHeaderDropData } from '../types/drag';

export interface BoardColumnDeleteOption {
  value: string;
  label: string;
}

export interface BoardColumnDeleteModalState {
  isOpen: boolean;
  title: string;
  message: string;
  reassignOptions: BoardColumnDeleteOption[];
  selectedReassignToId: string | null;
  errorMessage: string | null;
  onChangeReassignToId: (value: string | null) => void;
  onDelete: () => void;
  onCancel: () => void;
}

interface DeleteDraft {
  columnId: string;
  title: string;
  taskCount: number;
}

export interface UseBoardColumnDragOptions {
  collectionId: string;
  groupBy: BoardGroupBy;
  columns: BoardColumnModel[];
  setColumns: (updater: (prev: BoardColumnModel[]) => BoardColumnModel[]) => void;
  statuses?: ApiStatus[];
  sections?: ApiSection[];
  onError?: () => void;
  deleteMessage?: (groupBy: BoardGroupBy, taskCount: number) => string;
}

export interface UseBoardColumnDragResult {
  deleteModal: BoardColumnDeleteModalState | null;
  openDeleteColumn: (columnId: string) => void;
  closeDeleteColumn: () => void;
}

function isMoveableColumn(column: BoardColumnModel): boolean {
  return column.value !== null;
}

function columnValue(column: BoardColumnModel): string | null {
  return typeof column.value === 'string' ? column.value : null;
}

function columnIdValue(columnId: string): string {
  const separator = columnId.indexOf(':');
  return separator === -1 ? columnId : columnId.slice(separator + 1);
}

function columnDeleteMessage(groupBy: BoardGroupBy, taskCount: number): string {
  if (taskCount === 0) {
    return 'This column is empty. Delete it?';
  }
  if (groupBy === 'section') {
    return `This column has ${taskCount} task(s). They will move to the top level when you delete it.`;
  }
  return `This column has ${taskCount} task(s). Choose a status to move them to before deleting it.`;
}

async function handleDeleteError(err: unknown): Promise<string> {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong';
}

export function useBoardColumnDrag({
  collectionId,
  groupBy,
  columns,
  setColumns,
  onError,
  deleteMessage = columnDeleteMessage,
}: UseBoardColumnDragOptions): UseBoardColumnDragResult {
  const [draft, setDraft] = useState<DeleteDraft | null>(null);
  const [selectedReassignToId, setSelectedReassignToId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orderedColumns = useMemo(
    () => columns.filter(isMoveableColumn),
    [columns],
  );

  const reassignOptions = useMemo<BoardColumnDeleteOption[]>(() => {
    if (!draft || groupBy !== 'status') return [];
    return orderedColumns
      .filter((column) => column.id !== draft.columnId)
      .map((column) => ({ value: String(columnValue(column)), label: column.title }));
  }, [draft, groupBy, orderedColumns]);

  const openDeleteColumn = useCallback(
    (columnId: string) => {
      if (groupBy !== 'status' && groupBy !== 'section') return;
      const column = columns.find((candidate) => candidate.id === columnId);
      if (!column || !isMoveableColumn(column)) return;
      const options = groupBy === 'status'
        ? columns
            .filter((candidate) => candidate.id !== columnId && candidate.value !== null)
            .map((candidate) => ({ value: String(candidate.value), label: candidate.title }))
        : [];
      setDraft({ columnId, title: column.title, taskCount: column.tasks.length });
      setSelectedReassignToId(options[0]?.value ?? null);
      setErrorMessage(null);
    },
    [columns, groupBy],
  );

  const closeDeleteColumn = useCallback(() => {
    setDraft(null);
    setSelectedReassignToId(null);
    setErrorMessage(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!draft) return;
    const column = columns.find((candidate) => candidate.id === draft.columnId);
    if (!column || !isMoveableColumn(column)) {
      closeDeleteColumn();
      return;
    }

    try {
      if (groupBy === 'status') {
        const statusId = columnValue(column);
        if (!statusId) return;
        await apiDeleteStatus(statusId, selectedReassignToId ?? undefined);
      } else if (groupBy === 'section') {
        const sectionId = columnValue(column);
        if (!sectionId) return;
        await apiDeleteSection(sectionId);
      } else {
        return;
      }

      setColumns((prev) => prev.filter((candidate) => candidate.id !== column.id));
      closeDeleteColumn();
    } catch (err) {
      setErrorMessage(await handleDeleteError(err));
      onError?.();
    }
  }, [closeDeleteColumn, columns, draft, groupBy, onError, selectedReassignToId, setColumns]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (groupBy !== 'status' && groupBy !== 'section') return;
      const active = event.active.data.current as BoardColumnDragData | undefined;
      const over = event.over?.data.current as BoardColumnHeaderDropData | undefined;
      if (!active || !over) return;
      if (active.kind !== 'board-column' || over.kind !== 'board-column-header') return;
      if (active.collectionId !== collectionId || over.collectionId !== collectionId) return;
      if (active.groupBy !== groupBy || over.groupBy !== groupBy) return;

      const activeIndex = orderedColumns.findIndex((column) => column.id === active.columnId);
      const overIndex = orderedColumns.findIndex((column) => column.id === over.columnId);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      const before = columns;
      const reordered = arrayMove(orderedColumns, activeIndex, overIndex);
      setColumns(() => {
        const pinned = columns.filter((column) => !isMoveableColumn(column));
        if (pinned.length === 0) return reordered;
        return [
          ...pinned,
          ...reordered,
        ];
      });

      const position = overIndex;
      const entityId = columnIdValue(active.columnId);
      const update = groupBy === 'status'
        ? apiUpdateStatus(entityId, { position })
        : apiUpdateSection(entityId, { position });

      update.catch(() => {
        setColumns(() => before);
        onError?.();
      });
    },
    [collectionId, columns, groupBy, onError, orderedColumns, setColumns],
  );

  usePlannerDragHandlers('board-column', { onDragEnd: handleDragEnd });

  const deleteModal = draft
    ? {
        isOpen: true,
        title: draft.title,
        message: deleteMessage(groupBy, draft.taskCount),
        reassignOptions,
        selectedReassignToId,
        errorMessage,
        onChangeReassignToId: setSelectedReassignToId,
        onDelete: confirmDelete,
        onCancel: closeDeleteColumn,
      }
    : null;

  return {
    deleteModal,
    openDeleteColumn,
    closeDeleteColumn,
  };
}
