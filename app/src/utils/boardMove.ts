import type { ApiSection, ApiStatus, ApiTask, BoardOrder, TaskMoveInput } from '../types/api';
import type { BoardGroupBy, DropData, TaskDragData, TaskOrderScope } from '../types/drag';
import type { BoardA11yMessages, BoardMoveSnapshot, ResolvedBoardMove } from '../types/hooks';
import { flattenTasks, getSubtreeBlock } from './taskProjection';
import { parseColumnId } from './boardColumns';

const defaultA11yMessages: BoardA11yMessages = {
  dropToColumn: (column) => `Drop to move to ${column}.`,
  movedToColumn: (column) => `Moved to ${column}.`,
  dropAsSubtask: (title) => `Drop to place under ${title}.`,
};

function groupKey(value: string | number | null): string {
  return value === null ? '__none__' : String(value);
}

function sameGroupValue(a: string | number | null, b: string | number | null): boolean {
  return a === b || (a === null && b === null);
}

function getGroupValue(task: ApiTask, groupBy: BoardGroupBy): string | number | null {
  if (groupBy === 'status') return task.statusId ?? null;
  if (groupBy === 'priority') return task.priority;
  return task.sectionId ?? null;
}

function getGroupLabel(
  groupBy: BoardGroupBy,
  value: string | number | null,
  statuses: ApiStatus[],
  sections: ApiSection[],
): string {
  if (groupBy === 'status') {
    return statuses.find((status) => status.id === value)?.name ?? 'this status';
  }
  if (groupBy === 'priority') {
    return `Priority ${String(value)}`;
  }
  if (value === null) return 'No section';
  return sections.find((section) => section.id === value)?.name ?? 'this section';
}

function buildRootGroups(
  tasks: ApiTask[],
  boardOrder: BoardOrder,
  groupBy: BoardGroupBy,
): Map<string, ApiTask[]> {
  const roots = tasks.filter((task) => !task.parentTaskId);
  const positionMap = groupBy === 'status' ? boardOrder.status : boardOrder.priority;
  const sorted = [...roots].sort((a, b) => {
    const aValue = groupBy === 'section' ? a.orderValue : (positionMap[a.id] ?? a.orderValue);
    const bValue = groupBy === 'section' ? b.orderValue : (positionMap[b.id] ?? b.orderValue);
    if (aValue !== bValue) return aValue - bValue;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });

  const groups = new Map<string, ApiTask[]>();
  for (const task of sorted) {
    const key = groupKey(getGroupValue(task, groupBy));
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }
  return groups;
}

function parseTargetValue(
  groupBy: BoardGroupBy,
  tasks: ApiTask[],
  over: DropData,
): string | number | null | undefined {
  if (over.kind === 'task') {
    const target = tasks.find((task) => task.id === over.taskId);
    if (!target || target.parentTaskId) return undefined;
    return getGroupValue(target, groupBy);
  }

  if (over.kind !== 'board-column') return undefined;
  const parsed = parseColumnId(over.columnId);
  if (!parsed || parsed.groupBy !== groupBy) return undefined;
  return parsed.value;
}

function parseTargetScope(
  groupBy: BoardGroupBy,
  collectionId: string,
  value: string | number | null,
): TaskOrderScope {
  if (groupBy === 'status') {
    return { kind: 'status', collectionId, statusId: value as string | null };
  }
  if (groupBy === 'priority') {
    return { kind: 'priority', collectionId, priority: value as number };
  }
  if (typeof value === 'string') {
    return { kind: 'section', sectionId: value };
  }
  return { kind: 'collection', collectionId };
}

function updateStatusPriorityPositions(
  tasks: ApiTask[],
  boardOrder: BoardOrder,
  groupBy: 'status' | 'priority',
  active: ApiTask,
  targetValue: string | number | null,
  position: number,
  removeOnly: boolean,
): BoardOrder {
  const groups = buildRootGroups(tasks, boardOrder, groupBy);
  const sourceKey = groupKey(getGroupValue(active, groupBy));
  const source = [...(groups.get(sourceKey) ?? [])];
  const sourceIndex = source.findIndex((task) => task.id === active.id);
  if (sourceIndex !== -1) source.splice(sourceIndex, 1);
  groups.set(sourceKey, source);

  const next: BoardOrder = {
    status: { ...boardOrder.status },
    priority: { ...boardOrder.priority },
  };
  const positionMap = groupBy === 'status' ? next.status : next.priority;

  if (removeOnly) {
    delete positionMap[active.id];
  } else {
    const targetKey = groupKey(targetValue);
    const target = targetKey === sourceKey ? source : [...(groups.get(targetKey) ?? [])];
    if (targetKey !== sourceKey) groups.set(targetKey, target);
    const insertAt = Math.max(0, Math.min(position, target.length));
    target.splice(insertAt, 0, active);
    groups.set(targetKey, target);
  }

  for (const [key, group] of groups) {
    if (key !== sourceKey && !removeOnly && key !== groupKey(targetValue)) continue;
    group.forEach((task, index) => {
      positionMap[task.id] = index * 1000;
    });
  }

  return next;
}

function patchCompletion(
  tasks: ApiTask[],
  activeId: string,
  descendantIds: Set<string>,
  isCompleted: boolean,
): ApiTask[] {
  const completedAt = isCompleted ? new Date().toISOString() : undefined;
  return tasks.map((task) => {
    if (task.id === activeId || descendantIds.has(task.id)) {
      if (!isCompleted && task.id !== activeId) return task;
      return {
        ...task,
        isCompleted,
        completedAt,
      };
    }
    return task;
  });
}

/**
 * Resolve a board drag into the API move the server expects.
 */
export function resolveBoardMove({
  tasks,
  boardOrder,
  groupBy,
  collectionId,
  statuses,
  sections,
  active,
  over,
  a11y = defaultA11yMessages,
}: {
  tasks: ApiTask[];
  boardOrder: BoardOrder;
  groupBy: BoardGroupBy;
  collectionId: string;
  statuses: ApiStatus[];
  sections: ApiSection[];
  active: TaskDragData;
  over: DropData;
  a11y?: BoardA11yMessages;
}): ResolvedBoardMove | null {
  const activeTask = tasks.find((task) => task.id === active.taskId);
  if (!activeTask) return null;

  if (over.kind === 'card-subtasks') {
    const parent = tasks.find((task) => task.id === over.taskId);
    if (!parent || parent.id === activeTask.id) return null;
    return {
      input: {
        parentTaskId: parent.id,
        scope: parseTargetScope(groupBy, collectionId, getGroupValue(activeTask, groupBy)),
        position: Number.MAX_SAFE_INTEGER,
      },
      announcement: a11y.movedToColumn(parent.title),
      preview: a11y.dropAsSubtask(parent.title),
      parentTaskId: parent.id,
    };
  }

  const targetValue = parseTargetValue(groupBy, tasks, over);
  if (targetValue === undefined) return null;

  const rootGroups = buildRootGroups(tasks, boardOrder, groupBy);
  const sourceKey = groupKey(getGroupValue(activeTask, groupBy));
  const source = [...(rootGroups.get(sourceKey) ?? [])];
  const sourceIndex = source.findIndex((task) => task.id === activeTask.id);
  if (sourceIndex !== -1) source.splice(sourceIndex, 1);

  let position: number;
  if (over.kind === 'task') {
    const targetTask = tasks.find((task) => task.id === over.taskId);
    if (!targetTask || targetTask.id === activeTask.id || targetTask.parentTaskId) return null;
    const targetKey = groupKey(getGroupValue(targetTask, groupBy));
    const targetGroup = targetKey === sourceKey ? source : [...(rootGroups.get(targetKey) ?? [])];
    position = targetGroup.findIndex((task) => task.id === targetTask.id);
    if (position === -1) return null;
  } else {
    const targetKey = groupKey(targetValue);
    const targetGroup = targetKey === sourceKey ? source : [...(rootGroups.get(targetKey) ?? [])];
    position = targetGroup.length;
  }
  const targetLabel = getGroupLabel(groupBy, targetValue, statuses, sections);

  const input: TaskMoveInput = {
    parentTaskId: null,
    position,
    scope: { kind: 'collection', collectionId },
  };

  if (groupBy === 'status') {
    input.statusId = targetValue as string | null;
    input.scope = { kind: 'status', collectionId, statusId: targetValue as string | null };
  } else if (groupBy === 'priority') {
    input.priority = targetValue as number;
    input.scope = { kind: 'priority', collectionId, priority: targetValue as number };
  } else {
    input.sectionId = targetValue as string | null;
    input.scope = parseTargetScope(groupBy, collectionId, targetValue);
  }

  const announcement = a11y.movedToColumn(targetLabel);
  const preview = a11y.dropToColumn(targetLabel);

  return {
    input,
    announcement,
    preview,
    parentTaskId: null,
  };
}

/**
 * Apply the projected move to local state so the board settles immediately.
 */
export function applyBoardMoveLocally({
  tasks,
  boardOrder,
  groupBy,
  active,
  move,
  completionStatusId,
}: {
  tasks: ApiTask[];
  boardOrder: BoardOrder;
  groupBy: BoardGroupBy;
  active: TaskDragData;
  move: ResolvedBoardMove;
  completionStatusId: string | null;
}): BoardMoveSnapshot {
  const activeTask = tasks.find((task) => task.id === active.taskId);
  if (!activeTask) return { tasks, boardOrder };

  const rows = flattenTasks(tasks);
  const subtree = getSubtreeBlock(rows, activeTask.id);
  const subtreeIds = new Set(subtree.map((row) => row.id));
  const movedToCompletion = groupBy === 'status' && sameGroupValue(move.input.statusId ?? null, completionStatusId);
  const sourceKey = groupKey(getGroupValue(activeTask, groupBy));
  const targetValue =
    groupBy === 'status'
      ? (move.input.statusId ?? null)
      : groupBy === 'priority'
        ? (move.input.priority ?? activeTask.priority)
        : (move.input.sectionId ?? null);
  const targetKey = groupKey(targetValue);
  const isReparent = move.parentTaskId !== null;

  let next = tasks.map((task) => {
    if (task.id === activeTask.id) {
      return {
        ...task,
        parentTaskId: move.parentTaskId ?? undefined,
        depth: move.parentTaskId ? 1 : 0,
        ...(groupBy === 'status' ? { statusId: move.input.statusId ?? undefined } : {}),
        ...(groupBy === 'priority' ? { priority: move.input.priority ?? task.priority } : {}),
        ...(groupBy === 'section' ? { sectionId: move.input.sectionId ?? undefined } : {}),
      };
    }

    if (!subtreeIds.has(task.id)) return task;
    const nextTask: ApiTask = {
      ...task,
      depth: Math.max(0, (task.depth ?? 0) + ((move.parentTaskId ? 1 : 0) - (activeTask.depth ?? 0))),
    };
    if (groupBy === 'section' && move.input.sectionId !== undefined) {
      nextTask.sectionId = move.input.sectionId ?? undefined;
    }
    return nextTask;
  });

  if (groupBy === 'status') {
    next = patchCompletion(next, activeTask.id, subtreeIds, movedToCompletion);
    if (!movedToCompletion && activeTask.isCompleted) {
      next = next.map((task) =>
        task.id === activeTask.id ? { ...task, isCompleted: false, completedAt: undefined } : task,
      );
    }
  }

  if (groupBy === 'section' && move.input.sectionId !== undefined) {
    const changedSection = (activeTask.sectionId ?? null) !== move.input.sectionId;
    if (changedSection) {
      next = next.map((task) => {
        if (task.id === activeTask.id || subtreeIds.has(task.id)) {
          return { ...task, sectionId: move.input.sectionId ?? undefined };
        }
        return task;
      });
    }
  }

  if (groupBy === 'status' || groupBy === 'priority') {
    const updatedBoardOrder = updateStatusPriorityPositions(
      tasks,
      boardOrder,
      groupBy,
      activeTask,
      targetValue,
      move.input.position,
      isReparent,
    );
    return { tasks: next, boardOrder: updatedBoardOrder };
  }

  const sectionGroups = buildRootGroups(tasks, { status: {}, priority: {} }, 'section');
  const sourceGroup = [...(sectionGroups.get(sourceKey) ?? [])];
  const sourceIndex = sourceGroup.findIndex((task) => task.id === activeTask.id);
  if (sourceIndex !== -1) sourceGroup.splice(sourceIndex, 1);
  sectionGroups.set(sourceKey, sourceGroup);
  if (!isReparent) {
    const targetGroup = targetKey === sourceKey ? sourceGroup : [...(sectionGroups.get(targetKey) ?? [])];
    if (targetKey !== sourceKey) sectionGroups.set(targetKey, targetGroup);
    const insertAt = Math.max(0, Math.min(move.input.position, targetGroup.length));
    targetGroup.splice(insertAt, 0, activeTask);
    sectionGroups.set(targetKey, targetGroup);
  }

  const nextById = new Map(next.map((task) => [task.id, task]));
  for (const [key, group] of sectionGroups) {
    if (key !== sourceKey && !isReparent && key !== targetKey) continue;
    group.forEach((task, index) => {
      const current = nextById.get(task.id);
      if (current) nextById.set(task.id, { ...current, orderValue: index * 1000 });
    });
  }

  return {
    tasks: next.map((task) => nextById.get(task.id) ?? task),
    boardOrder,
  };
}

