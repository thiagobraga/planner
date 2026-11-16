export interface TaskTimeRow {
  due_time: string | null;
  deadline_date: string | Date | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  duration_minutes: number | null;
}

export interface TaskTimeFields {
  dueTime: string | null;
  deadlineDate: string | Date | null;
  deadlineTime: string | null;
  deadlineTimezone: string | null;
  durationMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
}

export interface TaskRow extends TaskTimeRow {
  id: string;
  user_id: string;
  collection_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  assignee_user_id: string | null;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | null;
  due_timezone: string | null;
  recurrence_rule: object | null;
  is_completed: boolean;
  completed_at: string | null;
  order_value: number;
  depth: number;
  type: string;
  status_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: number;
  collectionId?: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  labelIds?: string[];
  dueDate?: string | null;
  dueTime?: string | null;
  dueTimezone?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: object | null;
  type?: 'task' | 'note' | 'event';
  orderValue?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: number;
  collectionId?: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  dueTimezone?: string | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  durationMinutes?: number | null;
  recurrenceRule?: object | null;
  labelIds?: string[];
  type?: 'task' | 'note' | 'event';
}

/**
 * Which hand-sorted list a move's `position` counts within.
 *
 * A task holds a position in its collection *and* a position in its day, and the
 * two are independent - reordering Today must not disturb the collection's
 * order. Collection positions live in `tasks.order_value`; day positions live in
 * the `task_order` table (migration 025), which is also what lets a day rank
 * tasks drawn from several different collections.
 */
export type TaskOrderScope =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'day'; dueDate: string }
  | { kind: 'section'; sectionId: string }
  | { kind: 'status'; collectionId: string; statusId: string | null }
  | { kind: 'priority'; collectionId: string; priority: number };

export interface MoveTaskInput {
  parentTaskId: string | null;
  collectionId?: string;
  sectionId?: string | null;
  dueDate?: string | null;
  statusId?: string | null;
  priority?: number;
  scope: TaskOrderScope;
  position: number;
  /**
   * The sibling the task lands directly below (`null` for the top of the list).
   * Preferred over `position`: a client only sees the rows it renders, so its
   * index drifts from the server's whenever a sibling is hidden.
   */
  afterTaskId?: string | null;
}

export interface SubtreeRow {
  id: string;
  parent_task_id: string | null;
  depth: number;
  collection_id: string;
  section_id: string | null;
  due_date: string | null;
}

/** The fields a client needs to patch one task's position/place in the tree. */
export interface MovedTaskSummary {
  id: string;
  parentTaskId: string | null;
  collectionId: string;
  dueDate: string | null;
  orderValue: number;
  depth: number;
  statusId: string | null;
  priority: number;
  isCompleted: boolean;
}

export interface ReorganizeMove {
  taskId: string;
  dueDate: string;
}

export interface RenumberCollectionScopeOptions {
  collectionId: string;
  sectionId: string | null;
  parentTaskId: string | null;
  movedTaskId: string;
  position: number;
  afterTaskId?: string | null;
  depth: number;
  movedDueDate: string | null;
  movedStatusId: string | null;
  movedPriority: number;
  movedIsCompleted: boolean;
}

export interface RenumberOrderTableScopeOptions {
  userId: string;
  scopeType: 'day' | 'status' | 'priority';
  scopeId: string;
  collectionId: string;
  statusId: string | null;
  priority: number;
  movedTaskId: string;
  position: number;
  afterTaskId?: string | null;
  movedCollectionId: string;
  movedParentTaskId: string | null;
  movedDepth: number;
  movedOrderValue: number;
  movedDueDate: string | null;
  movedStatusId: string | null;
  movedPriority: number;
  movedIsCompleted: boolean;
}
