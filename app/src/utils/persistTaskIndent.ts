import type { Task } from '../components/TaskItem';
import type { TaskIndentMove } from '../types/taskIndent';
import { apiMoveTask } from '../api/client';
import { trackMove } from './moveEcho';
import { flattenTasks, getSubtreeBlock } from './taskProjection';

export function persistTaskIndent(
  id: string,
  move: TaskIndentMove,
  before: Task[],
  setTasks: (updater: (current: Task[]) => Task[]) => void,
  onSuccess: () => void,
  onFailure: () => void,
): void {
  const optimistic = new Map(move.tasks.map((task) => [task.id, task]));
  setTasks((current) => current.map((task) => optimistic.get(task.id) ?? task));
  if (id.startsWith('temp-')) return;
  const subtreeIds = getSubtreeBlock(flattenTasks(before), id).map((row) => row.id);
  const untrack = trackMove(subtreeIds);
  apiMoveTask(id, move.input)
    .then((response) => {
      const authoritative = new Map([...response.moved, ...response.reordered].map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => {
        const saved = authoritative.get(task.id);
        return saved ? {
          ...task,
          parentTaskId: saved.parentTaskId ?? undefined,
          indent: saved.depth,
          orderValue: saved.orderValue,
          collectionId: saved.collectionId,
          dueDate: saved.dueDate?.slice(0, 10),
          statusId: saved.statusId,
          priority: saved.priority,
        } : task;
      }));
      onSuccess();
    })
    .catch(() => {
      setTasks(() => before);
      onFailure();
    })
    .finally(untrack);
}
