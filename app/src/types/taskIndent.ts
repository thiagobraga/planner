import type { Task } from '../components/TaskItem';
import type { TaskOrderScope } from './drag';
import type { TaskMoveInput } from './api';

export interface TaskIndentMove {
  input: TaskMoveInput;
  tasks: Task[];
}

export type TaskIndentHandler = (
  id: string,
  direction: 1 | -1,
  visibleTasks: Task[],
  scope: TaskOrderScope,
) => void;

export type TaskListContextMenuHandler = (
  id: string,
  position: { x: number; y: number },
  visibleTasks: Task[],
  scope: TaskOrderScope,
) => void;

export interface TaskIndentMenuContext {
  taskId: string;
  position: { x: number; y: number };
  visibleTasks: Task[];
  scope: TaskOrderScope;
}
