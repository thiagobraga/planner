import type { Task } from '../components/TaskItem';
import type { TaskOrderScope } from '../types/drag';
import type { TaskIndentMove } from '../types/taskIndent';
import { flattenTasks, getSubtreeBlock, MAX_DEPTH } from './taskProjection';

export function resolveTaskIndent(
  visibleTasks: Task[], id: string, direction: 1 | -1, scope: TaskOrderScope,
): TaskIndentMove | null {
  const task = visibleTasks.find((item) => item.id === id);
  if (!task) return null;
  const sameList = visibleTasks.filter((item) =>
    item.collectionId === task.collectionId &&
    (item.sectionId ?? null) === (task.sectionId ?? null) &&
    (item.dueDate?.slice(0, 10) ?? null) === (task.dueDate?.slice(0, 10) ?? null),
  );
  const rows = flattenTasks(sameList);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const current = rows[index]!;
  const block = getSubtreeBlock(rows, id);
  let parentId: string | null;
  let position: number;

  if (direction === 1) {
    const previous = rows.slice(0, index).reverse().find((row) =>
      row.depth === current.depth && row.parentId === current.parentId,
    );
    if (!previous) return null;
    parentId = previous.id;
    position = rows.filter((row) => row.parentId === parentId).length;
  } else {
    if (!current.parentId) return null;
    const parent = rows.find((row) => row.id === current.parentId);
    if (!parent) return null;
    parentId = parent.parentId;
    position = rows.filter((row) => row.parentId === parentId).findIndex((row) => row.id === parent.id) + 1;
  }

  if (Math.max(...block.map((row) => row.depth + direction)) > MAX_DEPTH) return null;
  const siblings = rows.filter((row) => row.parentId === parentId && !block.some((member) => member.id === row.id));
  const previousOrder = siblings[position - 1]?.task.orderValue;
  const nextOrder = siblings[position]?.task.orderValue;
  const orderValue = previousOrder !== undefined && nextOrder !== undefined
    ? Math.floor((previousOrder + nextOrder) / 2)
    : previousOrder !== undefined ? previousOrder + 1000 : nextOrder !== undefined ? nextOrder - 1000 : 0;
  const blockIds = new Set(block.map((row) => row.id));
  const nextTasks = visibleTasks.map((item) => {
    if (!blockIds.has(item.id)) return item;
    return {
      ...item,
      indent: (rows.find((row) => row.id === item.id)?.depth ?? item.indent ?? 0) + direction,
      ...(item.id === id ? { parentTaskId: parentId ?? undefined, orderValue } : {}),
    };
  });
  return {
    input: {
      parentTaskId: parentId, scope, position,
      ...(scope.kind === 'status' ? { statusId: scope.statusId } : {}),
      ...(scope.kind === 'priority' ? { priority: scope.priority } : {}),
    },
    tasks: nextTasks,
  };
}
