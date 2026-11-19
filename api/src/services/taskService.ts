import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { attachLabels, verifyLabelOwnership } from './labelService.js';
import { recordActivity } from './activityService.js';
import type {
  CreateTaskInput,
  MoveTaskInput,
  ReorganizeMove,
  TaskOrderScope,
  TaskRow,
  UpdateTaskInput,
} from '../types/task.js';
import { getAccessibleTask } from './task/access.js';
import { publishTaskDeleted, publishTaskEvent } from './task/events.js';
import { formatTask } from './task/format.js';
import {
  MAX_DEPTH,
  validateTaskScalarFields,
  validateTimeNeedsDate,
  validationError,
} from './task/validation.js';
import { completeTask, reopenTask } from './task/completion.js';
import { moveTask } from './task/move.js';
import { reorderTask } from './task/ordering.js';
import { reorganizeTasks } from './task/reorganize.js';

export { updateTask } from './task/update.js';

export {
  completeTask,
  reopenTask,
  reorderTask,
  moveTask,
  reorganizeTasks,
};

export type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskOrderScope,
  MoveTaskInput,
  ReorganizeMove,
};

export async function createTask(userId: string, input: CreateTaskInput) {
  validateTaskScalarFields({
    title: input.title,
    priority: input.priority,
    type: input.type,
    requireTitle: true,
  });

  validateTimeNeedsDate(input, input.dueDate, input.deadlineDate);

  const labelIds = input.labelIds ?? [];
  await verifyLabelOwnership(labelIds, userId);

  let collectionId = input.collectionId;
  let sectionId = input.sectionId ?? null;
  let depth = 0;

  if (input.parentTaskId) {
    // Verify parent exists and user has access
    const parentTask = await getAccessibleTask(input.parentTaskId, userId);

    // Inherit parent's collection_id and section_id
    collectionId = parentTask.collection_id;
    sectionId = parentTask.section_id;
    depth = parentTask.depth + 1;

    if (depth > MAX_DEPTH) {
      throw new AppError({
        code: 'MAX_DEPTH_EXCEEDED',
        message: 'Maximum subtask nesting depth of 5 exceeded',
        statusCode: 400,
      });
    }
  }

  // If no collection specified and no parent, use Inbox
  if (!collectionId) {
    const inboxResult = await pool.query(
      `SELECT id FROM collections WHERE user_id = $1 AND is_inbox = true`,
      [userId],
    );
    collectionId = inboxResult.rows[0]?.id;
  }

  // Verify user has access to collection
  if (collectionId) {
    const collectionAccess = await pool.query(
      `SELECT id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
      [collectionId, userId],
    );
    if (collectionAccess.rows.length === 0) {
      throw validationError('collectionId', 'Collection not accessible');
    }
  }

  const id = uuidv4();
  const priority = input.priority ?? 4;
  const type = input.type ?? 'task';

  const insertQuery = `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, recurrence_rule, depth, type, order_value, due_time, due_timezone, deadline_date, deadline_time, deadline_timezone, duration_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       COALESCE($13::int, (
         SELECT COALESCE(MAX(order_value) + 1000, 0) FROM tasks
         WHERE collection_id IS NOT DISTINCT FROM $3::uuid
           AND section_id IS NOT DISTINCT FROM $4::uuid
           AND parent_task_id IS NOT DISTINCT FROM $5::uuid
       )),
       $14, $15, $16, $17, $18, $19)
     RETURNING *`;
  const insertValues = [
    id,
    userId,
    collectionId,
    sectionId,
    input.parentTaskId ?? null,
    input.title,
    input.description ?? null,
    priority,
    input.dueDate ?? null,
    input.recurrenceRule ?? null,
    depth,
    type,
    input.orderValue ?? null,
    input.dueTime ?? null,
    input.dueTime ? input.dueTimezone ?? null : null,
    input.deadlineDate ?? null,
    input.deadlineTime ?? null,
    input.deadlineTime ? input.deadlineTimezone ?? null : null,
    input.durationMinutes ?? null,
  ];

  let taskRow: TaskRow;
  if (labelIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(insertQuery, insertValues);
      const placeholders = labelIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO task_labels (task_id, label_id) VALUES ${placeholders}`,
        [id, ...labelIds],
      );
      await client.query('COMMIT');
      taskRow = result.rows[0] as TaskRow;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const result = await pool.query(insertQuery, insertValues);
    taskRow = result.rows[0] as TaskRow;
  }

  const [task] = await attachLabels([formatTask(taskRow)]);
  await recordActivity(pool, {
    userId,
    collectionId: task.collectionId,
    entityType: 'task',
    entityId: task.id,
    eventType: 'task_created',
    afterData: { title: task.title },
  });
  publishTaskEvent('created', userId, task);
  return task;
}

export async function deleteTask(taskId: string, userId: string): Promise<{ success: true }> {
  const task = await getAccessibleTask(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect all task IDs to delete (the task + all descendants via recursive CTE)
    const descendantsResult = await client.query(
      `WITH RECURSIVE subtree AS (
         SELECT id FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id FROM tasks t
         INNER JOIN subtree s ON t.parent_task_id = s.id
       )
       SELECT id FROM subtree`,
      [taskId],
    );

    const taskIds = descendantsResult.rows.map((r: { id: string }) => r.id);

    // Cancel all reminders for deleted tasks
    await client.query(`DELETE FROM reminders WHERE task_id = ANY($1)`, [taskIds]);

    // Delete all tasks (parent + subtasks)
    await client.query(`DELETE FROM tasks WHERE id = ANY($1)`, [taskIds]);

    // Append activity event
    await recordActivity(client, {
      userId,
      collectionId: task.collection_id,
      entityType: 'task',
      entityId: taskId,
      eventType: 'task_deleted',
      beforeData: { title: task.title },
    });

    await client.query('COMMIT');
    publishTaskDeleted(userId, taskId, task.collection_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}
