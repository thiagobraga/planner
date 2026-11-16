import { formatTimeFields } from '../../utils/taskTime.js';
import type { MovedTaskSummary, TaskRow } from '../../types/task.js';

export function formatTask(row: TaskRow) {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    sectionId: row.section_id,
    parentTaskId: row.parent_task_id,
    assigneeUserId: row.assignee_user_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    ...formatTimeFields(row),
    dueTimezone: row.due_timezone,
    recurrenceRule: row.recurrence_rule,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    orderValue: row.order_value,
    depth: row.depth,
    type: row.type,
    statusId: row.status_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMovedTaskSummary(task: ReturnType<typeof formatTask>): MovedTaskSummary {
  return {
    id: task.id,
    parentTaskId: task.parentTaskId,
    collectionId: task.collectionId,
    dueDate: task.dueDate,
    orderValue: task.orderValue,
    depth: task.depth,
    statusId: task.statusId,
    priority: task.priority,
    isCompleted: task.isCompleted,
  };
}
