import { useCallback, useRef, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { usePlannerDrag, usePlannerDragHandlers } from '../contexts/usePlannerDrag';
import { apiMoveTask } from '../api/client';
import type { BoardOrder } from '../types/api';
import type { DropData, TaskDragData } from '../types/drag';
import type { BoardMoveSnapshot, UseBoardDragOptions } from '../types/hooks';
import { trackMove } from '../utils/moveEcho';
import { applyBoardMoveLocally, resolveBoardMove } from '../utils/boardMove';
import { useI18n } from '../i18n/I18nContext';

export function useBoardDrag({
  enabled = true,
  tasks,
  boardOrder,
  groupBy,
  collectionId,
  statuses,
  sections,
  completionStatusId,
  setTasks,
  setBoardOrder,
  onError,
  onMoved,
}: UseBoardDragOptions) {
  const { t } = useI18n();
  const { setOverlay, announce } = usePlannerDrag();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const snapshot = useRef<BoardMoveSnapshot | null>(null);
  const lastPreview = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as TaskDragData | undefined;
      if (!data) return;
      const activeTask = tasks.find((task) => task.id === data.taskId);
      if (!activeTask) return;

      setActiveDragId(activeTask.id);
      snapshot.current = { tasks, boardOrder };
      lastPreview.current = null;

      const descendants = Math.max(0, data.subtreeIds.length - 1);
      setOverlay({ title: activeTask.title, descendantCount: descendants });
      announce(t('board.a11y.pickedUp', { title: activeTask.title }));
    },
    [tasks, boardOrder, setOverlay, announce, t],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const active = event.active.data.current as TaskDragData | undefined;
      const over = event.over?.data.current as DropData | undefined;
      if (!active) return;

      if (!over) {
        if (lastPreview.current !== 'No drop target.') {
          lastPreview.current = 'No drop target.';
          announce('No drop target.');
        }
        return;
      }

      const move = resolveBoardMove({
        tasks,
        boardOrder,
        groupBy,
        collectionId,
        statuses,
        sections,
        active,
        over,
        a11y: {
          dropToColumn: (column) => t('board.a11y.dropToColumn', { column }),
          movedToColumn: (column) => t('board.a11y.movedToColumn', { column }),
          dropAsSubtask: (title) => t('board.a11y.dropAsSubtask', { title }),
        },
      });
      const message = move?.preview ?? 'That is not a valid place to drop this card.';
      if (lastPreview.current === message) return;
      lastPreview.current = message;
      announce(message);
    },
    [tasks, boardOrder, groupBy, collectionId, statuses, sections, announce, t],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = event.active.data.current as TaskDragData | undefined;
      const over = event.over?.data.current as DropData | undefined;
      setActiveDragId(null);
      lastPreview.current = null;
      if (!active) return;

      const before = snapshot.current ?? { tasks, boardOrder };
      snapshot.current = null;

      if (!over) {
        announce('Move cancelled.');
        return;
      }

      if (active.taskId.startsWith('temp-')) {
        announce('This task is still being created. Try again in a moment.');
        return;
      }

      const move = resolveBoardMove({
        tasks,
        boardOrder,
        groupBy,
        collectionId,
        statuses,
        sections,
        active,
        over,
        a11y: {
          dropToColumn: (column) => t('board.a11y.dropToColumn', { column }),
          movedToColumn: (column) => t('board.a11y.movedToColumn', { column }),
          dropAsSubtask: (title) => t('board.a11y.dropAsSubtask', { title }),
        },
      });
      if (!move) {
        announce('That is not a valid place to drop this card.');
        return;
      }

      const next = applyBoardMoveLocally({
        tasks: before.tasks,
        boardOrder: before.boardOrder,
        groupBy,
        active,
        move,
        completionStatusId,
      });
      setTasks(() => next.tasks);
      setBoardOrder(() => next.boardOrder);

      const untrack = trackMove(active.subtreeIds);
      apiMoveTask(active.taskId, move.input)
        .then((res) => {
          const byId = new Map([...res.moved, ...res.reordered].map((summary) => [summary.id, summary]));
          setTasks((prev) =>
            prev.map((task) => {
              const summary = byId.get(task.id);
              if (!summary) return task;
              return {
                ...task,
                parentTaskId: summary.parentTaskId ?? undefined,
                collectionId: summary.collectionId,
                dueDate: summary.dueDate ?? undefined,
                depth: summary.depth,
                statusId: summary.statusId ?? undefined,
                priority: summary.priority,
                isCompleted: summary.isCompleted,
                completedAt: summary.isCompleted ? task.completedAt : undefined,
                ...(groupBy === 'section' ? { orderValue: summary.orderValue } : {}),
              };
            }),
          );
          if (groupBy === 'status' || groupBy === 'priority') {
            setBoardOrder((prev) => {
              const nextOrder: BoardOrder = {
                status: { ...prev.status },
                priority: { ...prev.priority },
              };
              const map = groupBy === 'status' ? nextOrder.status : nextOrder.priority;
              for (const summary of [...res.moved, ...res.reordered]) {
                if (summary.parentTaskId === null) {
                  map[summary.id] = summary.orderValue;
                } else {
                  delete map[summary.id];
                }
              }
              return nextOrder;
            });
          }
          announce(move.announcement);
          onMoved?.();
        })
        .catch(() => {
          setTasks(() => before.tasks);
          setBoardOrder(() => before.boardOrder);
          announce('Move failed. The card returned to its original position.');
          onError?.();
        })
        .finally(untrack);
    },
    [tasks, boardOrder, groupBy, collectionId, statuses, sections, completionStatusId, setTasks, setBoardOrder, announce, onError, onMoved, t],
  );

  const handleDragCancel = useCallback(() => {
    snapshot.current = null;
    lastPreview.current = null;
    setActiveDragId(null);
  }, []);

  usePlannerDragHandlers(
    'task',
    {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    { enabled },
  );

  return { activeDragId };
}
