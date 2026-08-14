import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { buildEvent, publishEvent } from './syncService.js';
import { syncCompletionToStatus, syncStatusToCompletion } from './completionSync.js';
import { attachLabels, verifyLabelOwnership } from './labelService.js';
import { computeNextOccurrence } from '../engines/recurrenceEngine.js';
import type { RecurrenceRule } from '../engines/recurrenceEngine.js';

interface TaskRow {
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
  due_time: string | null;
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

function formatTask(row: TaskRow) {
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
    dueTime: row.due_time,
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

async function verifyTaskAccess(taskId: string, userId: string): Promise<TaskRow> {
  const result = await pool.query(
    `SELECT t.* FROM tasks t
     WHERE t.id = $1
       AND (
         t.user_id = $2
         OR t.collection_id IN (
           SELECT collection_id FROM collaborators WHERE user_id = $2
         )
       )`,
    [taskId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: 'NOT_FOUND',
      message: 'Task not found',
      statusCode: 404,
    });
  }

  return result.rows[0] as TaskRow;
}

export async function completeTask(taskId: string, userId: string) {
  const task = await verifyTaskAccess(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Recurring task: compute next due date and clone instead of mutating in-place
    if (task.recurrence_rule && task.due_date) {
      const nextDueDateObj = computeNextOccurrence(
        {
          date: task.due_date,
          time: task.due_time ?? undefined,
          timezone: task.due_timezone ?? undefined,
        },
        task.recurrence_rule as RecurrenceRule
      );

      // 1. Mark current task completed, clear its recurrence_rule so it acts as history
      await client.query(
        `UPDATE tasks
         SET is_completed = true, completed_at = NOW(), recurrence_rule = NULL, updated_at = NOW()
         WHERE id = $1`,
        [taskId],
      );

      // 2. Clone the task
      const newId = uuidv4();
      const insertResult = await client.query(
        `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, due_time, due_timezone, recurrence_rule, depth, type, order_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          newId,
          userId,
          task.collection_id,
          task.section_id,
          task.parent_task_id,
          task.title,
          task.description,
          task.priority,
          nextDueDateObj.date,
          nextDueDateObj.time ?? null,
          nextDueDateObj.timezone ?? null,
          task.recurrence_rule,
          task.depth,
          task.type,
          task.order_value,
        ]
      );

      // 3. Clone labels if any exist
      const labelsResult = await client.query(`SELECT label_id FROM task_labels WHERE task_id = $1`, [taskId]);
      if (labelsResult.rows.length > 0) {
        const placeholders = labelsResult.rows.map((_, i) => `($1, $${i + 2})`).join(', ');
        const values = [newId, ...labelsResult.rows.map((r) => r.label_id)];
        await client.query(`INSERT INTO task_labels (task_id, label_id) VALUES ${placeholders}`, values);
      }

      // Record activity event
      await client.query(
        `INSERT INTO activity_events (user_id, collection_id, entity_type, entity_id, event_type, after_data)
         VALUES ($1, $2, 'task', $3, 'task_completed', $4)`,
        [userId, task.collection_id, taskId, JSON.stringify({ recurring: true, nextTaskId: newId })],
      );

      await syncStatusToCompletion(client, {
        taskId,
        userId,
        collectionId: task.collection_id,
        isCompleted: true,
      });

      await client.query('COMMIT');

      const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const [formattedOld] = await attachLabels([formatTask(updated.rows[0] as TaskRow)]);
      publishEvent(
        buildEvent({
          entityType: 'task',
          eventType: 'updated',
          entityId: formattedOld.id,
          userId,
          collectionId: formattedOld.collectionId,
          payload: formattedOld,
        }),
      ).catch((err) => console.error('[sync] publish failed', err));

      const [formattedNew] = await attachLabels([formatTask(insertResult.rows[0] as TaskRow)]);
      publishEvent(
        buildEvent({
          entityType: 'task',
          eventType: 'created',
          entityId: formattedNew.id,
          userId,
          collectionId: formattedNew.collectionId,
          payload: formattedNew,
        }),
      ).catch((err) => console.error('[sync] publish failed', err));

      return formattedOld;
    }

    // Non-recurring: mark complete
    await client.query(
      `UPDATE tasks
       SET is_completed = true, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [taskId],
    );

    // Cascade: mark all subtasks complete (recursive CTE)
    await client.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM tasks WHERE parent_task_id = $1
         UNION ALL
         SELECT t.id FROM tasks t
         INNER JOIN descendants d ON t.parent_task_id = d.id
       )
       UPDATE tasks
       SET is_completed = true, completed_at = NOW(), updated_at = NOW()
       WHERE id IN (SELECT id FROM descendants)`,
      [taskId],
    );

    // Record activity event
    await client.query(
      `INSERT INTO activity_events (user_id, collection_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_completed')`,
      [userId, task.collection_id, taskId],
    );

    await syncStatusToCompletion(client, {
      taskId,
      userId,
      collectionId: task.collection_id,
      isCompleted: true,
      includeDescendants: true,
    });

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const [formatted] = await attachLabels([formatTask(updated.rows[0] as TaskRow)]);
    publishEvent(
      buildEvent({
        entityType: 'task',
        eventType: 'completed',
        entityId: formatted.id,
        userId,
        collectionId: formatted.collectionId,
        payload: formatted,
      }),
    ).catch((err) => console.error('[sync] publish failed', err));
    return formatted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
  recurrenceRule?: object | null;
  type?: 'task' | 'note';
  orderValue?: number;
}

export async function createTask(userId: string, input: CreateTaskInput) {
  // Validate title length (1-500 chars)
  if (!input.title || input.title.length === 0 || input.title.length > 500) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'title', message: 'Title must be between 1 and 500 characters' }],
    });
  }

  // Validate priority (1-4)
  if (input.priority !== undefined) {
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: [{ field: 'priority', message: 'Priority must be an integer between 1 and 4' }],
      });
    }
  }

  // Validate type
  if (input.type !== undefined && input.type !== 'task' && input.type !== 'note') {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'type', message: "type must be 'task' or 'note'" }],
    });
  }

  const labelIds = input.labelIds ?? [];
  await verifyLabelOwnership(labelIds, userId);

  let collectionId = input.collectionId;
  let sectionId = input.sectionId ?? null;
  let depth = 0;

  if (input.parentTaskId) {
    // Verify parent exists and user has access
    const parentTask = await verifyTaskAccess(input.parentTaskId, userId);

    // Inherit parent's collection_id and section_id
    collectionId = parentTask.collection_id;
    sectionId = parentTask.section_id;
    depth = parentTask.depth + 1;

    if (depth > 5) {
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
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Collection not accessible',
        statusCode: 400,
        details: [{ field: 'collectionId', message: 'Collection not accessible' }],
      });
    }
  }

  const id = uuidv4();
  const priority = input.priority ?? 4;
  const type = input.type ?? 'task';

  const insertQuery = `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, recurrence_rule, depth, type, order_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
    input.orderValue ?? 0,
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
  publishEvent(
    buildEvent({
      entityType: 'task',
      eventType: 'created',
      entityId: task.id,
      userId,
      collectionId: task.collectionId,
      payload: task,
    }),
  ).catch((err) => console.error('[sync] publish failed', err));
  return task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: number;
  collectionId?: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  recurrenceRule?: object | null;
  labelIds?: string[];
  type?: 'task' | 'note';
}

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
  // Validate title length (1-500 chars) if provided
  if (input.title !== undefined) {
    if (input.title.length === 0 || input.title.length > 500) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: [{ field: 'title', message: 'Title must be between 1 and 500 characters' }],
      });
    }
  }

  // Validate priority (1-4) if provided
  if (input.priority !== undefined) {
    if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: [{ field: 'priority', message: 'Priority must be an integer between 1 and 4' }],
      });
    }
  }

  // Validate type if provided
  if (input.type !== undefined && input.type !== 'task' && input.type !== 'note') {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'type', message: "type must be 'task' or 'note'" }],
    });
  }

  await verifyLabelOwnership(input.labelIds ?? [], userId);
  const task = await verifyTaskAccess(taskId, userId);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  // Depth shift applied to the whole descendant subtree when the task is reparented.
  let reparentDelta: number | undefined;

  // Handle parentTaskId changes (depth enforcement + cycle detection)
  if (input.parentTaskId !== undefined) {
    if (input.parentTaskId === null) {
      // Removing parent - promote to top level (depth 0)
      setClauses.push(`parent_task_id = NULL`);
      setClauses.push(`depth = 0`);
      reparentDelta = 0 - task.depth;
    } else {
      // Verify parent exists and user has access
      const parentTask = await verifyTaskAccess(input.parentTaskId, userId);

      // Cycle detection: walk up parent chain from proposed parent
      await detectCycle(taskId, input.parentTaskId);

      const newDepth = parentTask.depth + 1;
      if (newDepth > 5) {
        throw new AppError({
          code: 'MAX_DEPTH_EXCEEDED',
          message: 'Maximum subtask nesting depth of 5 exceeded',
          statusCode: 400,
        });
      }

      // Check descendants depth shift
      const maxDescendantDepthResult = await pool.query(
        `WITH RECURSIVE descendants AS (
           SELECT id, depth FROM tasks WHERE parent_task_id = $1
           UNION ALL
           SELECT t.id, t.depth FROM tasks t
           INNER JOIN descendants d ON t.parent_task_id = d.id
         )
         SELECT MAX(depth) as max_depth FROM descendants`,
        [taskId],
      );
      const maxDescendantDepth = maxDescendantDepthResult.rows[0]?.max_depth ?? task.depth;
      const depthDelta = maxDescendantDepth - task.depth;
      if (newDepth + depthDelta > 5) {
        throw new AppError({
          code: 'MAX_DEPTH_EXCEEDED',
          message: 'Maximum subtask nesting depth of 5 exceeded',
          statusCode: 400,
        });
      }

      reparentDelta = newDepth - task.depth;

      setClauses.push(`parent_task_id = $${paramIndex++}`);
      values.push(input.parentTaskId);
      setClauses.push(`depth = $${paramIndex++}`);
      values.push(newDepth);

      // Inherit parent's collection_id and section_id
      setClauses.push(`collection_id = $${paramIndex++}`);
      values.push(parentTask.collection_id);
      setClauses.push(`section_id = $${paramIndex++}`);
      values.push(parentTask.section_id);
    }
  }

  if (input.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }

  if (input.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }

  if (input.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    values.push(input.priority);
  }

  if (input.type !== undefined) {
    setClauses.push(`type = $${paramIndex++}`);
    values.push(input.type);
  }

  if (input.collectionId !== undefined && input.parentTaskId === undefined) {
    // Verify user has access to target collection
    const collectionAccess = await pool.query(
      `SELECT id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
      [input.collectionId, userId],
    );
    if (collectionAccess.rows.length === 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Collection not accessible',
        statusCode: 400,
        details: [{ field: 'collectionId', message: 'Collection not accessible' }],
      });
    }

    setClauses.push(`collection_id = $${paramIndex++}`);
    values.push(input.collectionId);

    // Moving to different collection clears section_id
    if (input.collectionId !== task.collection_id) {
      setClauses.push(`section_id = NULL`);
    }
  }

  if (
    input.sectionId !== undefined &&
    input.collectionId === undefined &&
    input.parentTaskId === undefined
  ) {
    setClauses.push(`section_id = $${paramIndex++}`);
    values.push(input.sectionId);
  }

  if (input.dueDate !== undefined) {
    setClauses.push(`due_date = $${paramIndex++}`);
    values.push(input.dueDate);
  }

  if (input.recurrenceRule !== undefined) {
    setClauses.push(`recurrence_rule = $${paramIndex++}`);
    values.push(input.recurrenceRule);
  }

  if (setClauses.length === 0 && input.labelIds === undefined) {
    const [unchanged] = await attachLabels([formatTask(task)]);
    return unchanged;
  }

  setClauses.push(`updated_at = NOW()`);

  values.push(taskId);
  const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  // When reparenting shifts the task's own depth, the entire descendant subtree
  // must shift by the same delta so relative nesting is preserved (Phase 6 rule 5).
  const shiftsDescendants = reparentDelta !== undefined && reparentDelta !== 0;
  const needsTransaction = shiftsDescendants || input.labelIds !== undefined;

  let taskRow: TaskRow;
  if (needsTransaction) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(query, values);
      if (shiftsDescendants) {
        await client.query(
          `WITH RECURSIVE descendants AS (
             SELECT id FROM tasks WHERE parent_task_id = $1
             UNION ALL
             SELECT t.id FROM tasks t
             INNER JOIN descendants d ON t.parent_task_id = d.id
           )
           UPDATE tasks SET depth = depth + $2, updated_at = NOW()
           WHERE id IN (SELECT id FROM descendants)`,
          [taskId, reparentDelta],
        );
      }
      if (input.labelIds !== undefined) {
        await client.query(`DELETE FROM task_labels WHERE task_id = $1`, [taskId]);
        if (input.labelIds.length > 0) {
          const placeholders = input.labelIds.map((_, i) => `($1, $${i + 2})`).join(', ');
          await client.query(
            `INSERT INTO task_labels (task_id, label_id) VALUES ${placeholders}`,
            [taskId, ...input.labelIds],
          );
        }
      }
      await client.query('COMMIT');
      taskRow = result.rows[0] as TaskRow;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const result = await pool.query(query, values);
    taskRow = result.rows[0] as TaskRow;
  }

  const [formatted] = await attachLabels([formatTask(taskRow)]);
  publishEvent(
    buildEvent({
      entityType: 'task',
      eventType: 'updated',
      entityId: formatted.id,
      userId,
      collectionId: formatted.collectionId,
      payload: formatted,
    }),
  ).catch((err) => console.error('[sync] publish failed', err));
  return formatted;
}

async function detectCycle(taskId: string, proposedParentId: string): Promise<void> {
  // Walk up from proposedParentId. If we encounter taskId, it's a cycle.
  // Use a recursive CTE to get all ancestors of proposedParentId
  const ancestors = await pool.query(
    `WITH RECURSIVE ancestor_chain AS (
       SELECT id, parent_task_id FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id, t.parent_task_id FROM tasks t
       INNER JOIN ancestor_chain a ON t.id = a.parent_task_id
     )
     SELECT id FROM ancestor_chain WHERE id = $2`,
    [proposedParentId, taskId],
  );

  if (ancestors.rows.length > 0) {
    throw new AppError({
      code: 'CYCLIC_REFERENCE',
      message: 'Setting this parent would create a cyclic reference',
      statusCode: 400,
    });
  }
}

export async function reopenTask(taskId: string, userId: string) {
  const task = await verifyTaskAccess(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE tasks
       SET is_completed = false, completed_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [taskId],
    );

    // Record activity event
    await client.query(
      `INSERT INTO activity_events (user_id, collection_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_reopened')`,
      [userId, task.collection_id, taskId],
    );

    await syncStatusToCompletion(client, {
      taskId,
      userId,
      collectionId: task.collection_id,
      isCompleted: false,
    });

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const [formatted] = await attachLabels([formatTask(updated.rows[0] as TaskRow)]);
    publishEvent(
      buildEvent({
        entityType: 'task',
        eventType: 'uncompleted',
        entityId: formatted.id,
        userId,
        collectionId: formatted.collectionId,
        payload: formatted,
      }),
    ).catch((err) => console.error('[sync] publish failed', err));
    return formatted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reorderTask(taskId: string, userId: string, position: number) {
  if (!Number.isInteger(position) || position < 0) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'position', message: 'Position must be a non-negative integer' }],
    });
  }

  const task = await verifyTaskAccess(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get sibling tasks (same collection + section + parent) ordered by current order_value
    const siblingsResult = await client.query(
      `SELECT id, order_value FROM tasks
       WHERE collection_id = $1
         AND section_id IS NOT DISTINCT FROM $2
         AND parent_task_id IS NOT DISTINCT FROM $3
         AND id != $4
       ORDER BY order_value ASC`,
      [task.collection_id, task.section_id, task.parent_task_id, taskId],
    );

    const siblings = siblingsResult.rows as { id: string; order_value: number }[];

    // Clamp position to valid range
    const clampedPosition = Math.min(position, siblings.length);

    // Insert the task at the target position in the siblings list
    siblings.splice(clampedPosition, 0, { id: taskId, order_value: 0 });

    // Reassign order_values using gap-based ordering (multiply by 1000)
    for (let i = 0; i < siblings.length; i++) {
      const newOrderValue = i * 1000;
      await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
        newOrderValue,
        siblings[i].id,
      ]);
    }

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    return formatTask(updated.rows[0] as TaskRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
}

const MAX_DEPTH = 5;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validationError(field: string, message: string): AppError {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    statusCode: 400,
    details: [{ field, message }],
  });
}

function validateMoveInput(input: MoveTaskInput): void {
  if (!input || typeof input !== 'object') {
    throw validationError('body', 'Move input is required');
  }
  if (input.parentTaskId !== null && typeof input.parentTaskId !== 'string') {
    throw validationError('parentTaskId', 'Parent task id must be a string or null');
  }
  if (input.collectionId !== undefined && typeof input.collectionId !== 'string') {
    throw validationError('collectionId', 'Collection id must be a string');
  }
  if (
    input.sectionId !== undefined &&
    input.sectionId !== null &&
    typeof input.sectionId !== 'string'
  ) {
    throw validationError('sectionId', 'Section id must be a string or null');
  }
  if (
    input.dueDate !== undefined &&
    input.dueDate !== null &&
    !ISO_DATE.test(input.dueDate)
  ) {
    throw validationError('dueDate', 'Due date must be an ISO date (YYYY-MM-DD)');
  }
  if (input.statusId !== undefined && input.statusId !== null && typeof input.statusId !== 'string') {
    throw validationError('statusId', 'Status id must be a string or null');
  }
  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4)
  ) {
    throw validationError('priority', 'Priority must be an integer between 1 and 4');
  }
  if (!Number.isInteger(input.position) || input.position < 0) {
    throw validationError('position', 'Position must be a non-negative integer');
  }

  const scope = input.scope;
  if (!scope || typeof scope !== 'object') {
    throw validationError('scope', 'Ordering scope is required');
  }
  if (scope.kind === 'collection') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Collection scope requires a collection id');
    }
  } else if (scope.kind === 'day') {
    if (!ISO_DATE.test(scope.dueDate ?? '')) {
      throw validationError('scope.dueDate', 'Day scope requires an ISO date (YYYY-MM-DD)');
    }
  } else if (scope.kind === 'section') {
    if (typeof scope.sectionId !== 'string') {
      throw validationError('scope.sectionId', 'Section scope requires a section id');
    }
  } else if (scope.kind === 'status') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Status scope requires a collection id');
    }
    if (scope.statusId !== null && typeof scope.statusId !== 'string') {
      throw validationError('scope.statusId', 'Status scope requires a status id or null');
    }
  } else if (scope.kind === 'priority') {
    if (typeof scope.collectionId !== 'string') {
      throw validationError('scope.collectionId', 'Priority scope requires a collection id');
    }
    if (!Number.isInteger(scope.priority) || scope.priority < 1 || scope.priority > 4) {
      throw validationError('scope.priority', 'Priority scope requires an integer between 1 and 4');
    }
  } else {
    throw validationError(
      'scope.kind',
      "Ordering scope must be 'collection', 'day', 'section', 'status' or 'priority'",
    );
  }
}

interface SubtreeRow {
  id: string;
  parent_task_id: string | null;
  depth: number;
  collection_id: string;
  section_id: string | null;
  due_date: string | null;
}

/** The fields a client needs to patch one task's position/place in the tree. */
interface MovedTaskSummary {
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

function toMovedTaskSummary(task: ReturnType<typeof formatTask>): MovedTaskSummary {
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

/**
 * Structurally move a task, carrying its entire descendant subtree.
 *
 * Deliberately separate from `updateTask`: this rewrites tree position, list
 * membership and the ordering of everything around it, and every one of those
 * writes has to land together. A partial move - a reparented root whose children
 * kept the old depth, say - leaves the tree unrenderable, so the whole operation
 * is one transaction that rolls back intact.
 */
export async function moveTask(taskId: string, userId: string, input: MoveTaskInput) {
  validateMoveInput(input);

  // Authenticate before resolving anything else, so an unauthorized caller
  // cannot probe which task or collection ids exist by reading error shapes.
  const task = await verifyTaskAccess(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the dragged task and its descendants for the duration. Two concurrent
    // moves touching the same subtree would otherwise interleave their
    // renumbering and leave duplicate order values behind.
    const subtreeResult = await client.query(
      `WITH RECURSIVE subtree AS (
         SELECT id, parent_task_id, depth, collection_id, section_id, due_date
         FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id, t.parent_task_id, t.depth, t.collection_id, t.section_id, t.due_date
         FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
       )
       SELECT * FROM subtree ORDER BY depth ASC`,
      [taskId],
    );
    const subtree = subtreeResult.rows as SubtreeRow[];
    const subtreeIds = subtree.map((r) => r.id);

    await client.query(`SELECT id FROM tasks WHERE id = ANY($1::uuid[]) FOR UPDATE`, [subtreeIds]);

    // ── Resolve the destination ────────────────────────────────────────────────
    let destParent: TaskRow | null = null;
    if (input.parentTaskId) {
      if (input.parentTaskId === taskId) {
        throw validationError('parentTaskId', 'A task cannot be its own parent');
      }
      // Reparenting into your own subtree would detach that whole branch from
      // the tree - it would still exist, but nothing would reach it.
      if (subtreeIds.includes(input.parentTaskId)) {
        throw validationError('parentTaskId', 'A task cannot be moved inside its own subtree');
      }
      destParent = await verifyTaskAccess(input.parentTaskId, userId);
    }

    const rootOldDepth = task.depth;
    const rootNewDepth = destParent ? destParent.depth + 1 : 0;
    const depthDelta = rootNewDepth - rootOldDepth;

    const deepest = subtree.reduce((max, r) => Math.max(max, r.depth), rootOldDepth);
    if (deepest + depthDelta > MAX_DEPTH) {
      throw validationError(
        'parentTaskId',
        `Move would nest deeper than ${MAX_DEPTH} levels`,
      );
    }

    // Reparenting inherits the new parent's collection and section; an explicit
    // collectionId only applies when moving to the top level.
    const destCollectionId = destParent
      ? destParent.collection_id
      : (input.collectionId ?? task.collection_id);
    // `undefined` keeps the current section for plain reorders. When the move
    // transfers the task to another collection without an explicit section, it
    // has to land at top level so collection views can render it.
    const destSectionId = destParent
      ? destParent.section_id
      : (
          input.sectionId !== undefined
            ? input.sectionId
            : input.collectionId !== undefined && input.collectionId !== task.collection_id
              ? null
              : task.section_id
        );

    // Task ownership can outlive collaboration membership, so task access alone
    // does not prove the user still has access to the resolved destination.
    await verifyCollectionAccess(destCollectionId, userId);

    // `undefined` keeps the current date - that is what makes a sidebar drop
    // file a dated task into a collection without knocking it off its day.
    const destDueDate = input.dueDate === undefined ? task.due_date : input.dueDate;

    const crossesCollection = destCollectionId !== task.collection_id;
    const crossesDate = destDueDate !== task.due_date;
    const destStatusId = input.statusId !== undefined
      ? input.statusId
      : crossesCollection
        ? null
        : task.status_id;
    const destPriority = input.priority ?? task.priority;
    const statusChanged = destStatusId !== task.status_id;

    if (input.scope.kind === 'status') {
      if (input.scope.collectionId !== destCollectionId) {
        throw validationError('scope.collectionId', 'Status scope must match the destination collection');
      }
      if (input.scope.statusId !== destStatusId) {
        throw validationError('scope.statusId', 'Status scope must match the destination status');
      }
    }
    if (input.scope.kind === 'priority') {
      if (input.scope.collectionId !== destCollectionId) {
        throw validationError('scope.collectionId', 'Priority scope must match the destination collection');
      }
      if (input.scope.priority !== destPriority) {
        throw validationError('scope.priority', 'Priority scope must match the destination priority');
      }
    }

    let destStatusIsCompletion = false;
    if (destStatusId) {
      const statusResult = await client.query(
        `SELECT s.id, c.completion_status_id
         FROM task_statuses s
         INNER JOIN collections c ON c.id = s.collection_id
         WHERE s.id = $1 AND s.collection_id = $2`,
        [destStatusId, destCollectionId],
      );
      if (statusResult.rows.length === 0) {
        throw validationError('statusId', 'Status must belong to the destination collection');
      }
      destStatusIsCompletion = statusResult.rows[0].completion_status_id === destStatusId;
    }

    // ── Apply the move to the root ─────────────────────────────────────────────
    await client.query(
      `UPDATE tasks
       SET parent_task_id = $1,
           collection_id = $2,
           section_id = $3,
           due_date = $4,
           status_id = $5,
           priority = COALESCE($6::int, priority),
           previous_status_id = CASE
             WHEN $7::boolean THEN NULL
             WHEN $8::boolean AND $9::boolean THEN status_id
             WHEN $8::boolean THEN NULL
             ELSE previous_status_id
           END,
           depth = $10,
           updated_at = NOW()
       WHERE id = $11`,
      [
        input.parentTaskId,
        destCollectionId,
        destSectionId,
        destDueDate,
        destStatusId,
        input.priority ?? null,
        crossesCollection,
        statusChanged,
        destStatusIsCompletion,
        rootNewDepth,
        taskId,
      ],
    );

    let rootIsCompleted = task.is_completed;
    if (statusChanged) {
      const completionResult = await syncCompletionToStatus(client, {
        taskId,
        userId,
        statusId: destStatusId,
        collectionId: destCollectionId,
      });
      if (completionResult === 'completed') rootIsCompleted = true;
      if (completionResult === 'reopened') rootIsCompleted = false;
    }

    // ── Carry the descendants ──────────────────────────────────────────────────
    // Their parent links and relative order are untouched; only the values that
    // are inherited from the root shift. Explicit status and priority changes
    // apply to the root only; crossing collections clears stale descendant
    // status references because statuses are collection-owned.
    const descendantIds = subtreeIds.filter((id) => id !== taskId);
    if (descendantIds.length > 0) {
      if (depthDelta !== 0) {
        await client.query(
          `UPDATE tasks SET depth = depth + $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [depthDelta, descendantIds],
        );
      }
      if (crossesCollection || destSectionId !== task.section_id) {
        // Descendants inherit the moved root's collection and section, so any
        // move that changes either value has to rewrite the whole subtree.
        if (crossesCollection) {
          await client.query(
            `UPDATE tasks
             SET collection_id = $1,
                 section_id = $2,
                 status_id = NULL,
                 previous_status_id = NULL,
                 updated_at = NOW()
             WHERE id = ANY($3::uuid[])`,
            [destCollectionId, destSectionId, descendantIds],
          );
        } else {
          await client.query(
            `UPDATE tasks SET collection_id = $1, section_id = $2, updated_at = NOW()
             WHERE id = ANY($3::uuid[])`,
            [destCollectionId, destSectionId, descendantIds],
          );
        }
      }
      if (crossesDate) {
        await client.query(
          `UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [destDueDate, descendantIds],
        );
      }
    }

    // ── Update day membership ──────────────────────────────────────────────────
    // Runs before the scope repositioning below, not after: repositioning writes
    // the dragged task's row in the target day, and a later bulk delete would
    // wipe exactly that row and leave the task absent from its own day's order.
    if (crossesDate) {
      await client.query(
        `DELETE FROM task_order WHERE task_id = ANY($1::uuid[]) AND scope_type = 'day'`,
        [subtreeIds],
      );
      if (destDueDate) {
        for (const id of subtreeIds) {
          await appendToDayScope(client, task.user_id, id, destDueDate);
        }
      }
    }

    // ── Reposition within the target ordering scope ────────────────────────────
    // Sibling order values are already gap-spaced 1000 apart, so a single-row
    // drag usually needs one midpoint write, not a renumber of the whole list.
    // Removing the task from its old list needs no separate cleanup: gap
    // numbering tolerates a slightly bigger hole where it used to sit.
    // Section scope reorders the exact same (collection, section) sibling list
    // a plain collection-scoped move already scopes by - it exists as its own
    // `TaskOrderScope` kind only because the client resolves a drop onto an
    // empty section differently than one onto a sibling row, not because the
    // server orders it differently.
    let reordered: MovedTaskSummary[];
    if (input.scope.kind === 'day') {
      reordered = await renumberOrderTableScope(client, {
        userId: task.user_id,
        scopeType: 'day',
        scopeId: input.scope.dueDate,
        collectionId: destCollectionId,
        statusId: destStatusId,
        priority: destPriority,
        movedTaskId: taskId,
        position: input.position,
        movedCollectionId: destCollectionId,
        movedParentTaskId: input.parentTaskId,
        movedDepth: rootNewDepth,
        movedOrderValue: task.order_value,
        movedDueDate: destDueDate,
        movedStatusId: destStatusId,
        movedPriority: destPriority,
        movedIsCompleted: rootIsCompleted,
      });
    } else if (input.scope.kind === 'status' || input.scope.kind === 'priority') {
      reordered = await renumberOrderTableScope(client, {
        userId: task.user_id,
        scopeType: input.scope.kind,
        scopeId: input.scope.kind === 'status'
          ? (input.scope.statusId ?? 'none')
          : String(input.scope.priority),
        collectionId: destCollectionId,
        statusId: destStatusId,
        priority: destPriority,
        movedTaskId: taskId,
        position: input.position,
        movedCollectionId: destCollectionId,
        movedParentTaskId: input.parentTaskId,
        movedDepth: rootNewDepth,
        movedOrderValue: task.order_value,
        movedDueDate: destDueDate,
        movedStatusId: destStatusId,
        movedPriority: destPriority,
        movedIsCompleted: rootIsCompleted,
      });
    } else {
      reordered = await renumberCollectionScope(client, {
        collectionId: destCollectionId,
        sectionId: destSectionId,
        parentTaskId: input.parentTaskId,
        movedTaskId: taskId,
        position: input.position,
        depth: rootNewDepth,
        movedDueDate: destDueDate,
        movedStatusId: destStatusId,
        movedPriority: destPriority,
        movedIsCompleted: rootIsCompleted,
      });
    }

    await client.query('COMMIT');

    // ── Report every record the client must patch ──────────────────────────────
    // Scoped to just the dragged subtree - not bloated, no change needed here.
    //
    // A day-scoped move never touches `tasks.order_value` - only `task_order`.
    // Reporting the raw column here would hand the client `orderValue: 0` for
    // every subtree member on a day-scoped move, snapping the row back to the
    // front of the list the moment this "authoritative" patch lands, even
    // though the `reordered` position was written correctly. Every row that
    // has a day position must report that instead.
    const movedResult = await pool.query(
      `SELECT t.*, o.position AS day_position
       FROM tasks t
       LEFT JOIN task_order o
         ON o.task_id = t.id
        AND o.scope_type = 'day'
        AND o.scope_id = to_char(t.due_date, 'YYYY-MM-DD')
       WHERE t.id = ANY($1::uuid[]) ORDER BY t.depth ASC, t.order_value ASC`,
      [subtreeIds],
    );
    const movedTasks = (movedResult.rows as (TaskRow & { day_position: number | null })[]).map(
      (row) => ({ ...formatTask(row), dayPosition: row.day_position }),
    );
    const moved = movedTasks.map((task) => ({
      ...toMovedTaskSummary(task),
      orderValue: task.dayPosition ?? task.orderValue,
    }));

    const root = movedTasks.find((t) => t.id === taskId)!;
    publishEvent(
      buildEvent({
        entityType: 'task',
        eventType: 'updated',
        entityId: taskId,
        userId,
        collectionId: root.collectionId,
        // The payload must BE the task: every existing consumer reads it as one
        // (`apiToTask(event.payload as ApiTask)`). Wrapping it in an envelope
        // yields an all-undefined task that blanks the row it replaces.
        // affectedIds rides alongside as an extra field, which those consumers
        // ignore and an order-aware one can use.
        payload: { ...root, affectedIds: [...subtreeIds, ...reordered.map((t) => t.id)] },
      }),
    ).catch((err) => console.error('[sync] publish failed', err));

    return { moved, reordered };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function verifyCollectionAccess(collectionId: string, userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM collections
     WHERE id = $1
       AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
    [collectionId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError({ code: 'NOT_FOUND', message: 'Collection not found', statusCode: 404 });
  }
}

type Client = PoolClient;

/**
 * The order value that sits strictly between two flanking siblings (or beyond
 * a missing side, following the existing 1000-unit gap convention: siblings
 * are spaced ~1000 apart and the first sits near 0), or `null` if the gap has
 * collapsed and there is no integer room left - e.g. adjacent values `0` and
 * `1`, or prepending before a sibling already sitting at `0`.
 */
function midpointOrFallback(prev: number | null, next: number | null): number | null {
  if (prev === null && next === null) return 0;
  if (prev === null) {
    const candidate = next! - 1000;
    return candidate >= 0 ? candidate : null;
  }
  if (next === null) return prev + 1000;
  const mid = Math.floor((prev + next) / 2);
  return mid > prev && mid < next ? mid : null;
}

/**
 * Place `movedTaskId` at `position` among its new siblings, gap-numbered.
 * Siblings are already spaced ~1000 apart, so the common case is a single
 * midpoint write for the moved task alone; only a collapsed gap falls back to
 * renumbering the whole list. Returns the rows actually written, mappable to
 * `MovedTaskSummary` by the caller without a second query.
 */
async function renumberCollectionScope(
  client: Client,
  opts: {
    collectionId: string;
    sectionId: string | null;
    parentTaskId: string | null;
    movedTaskId: string;
    position: number;
    depth: number;
    movedDueDate: string | null;
    movedStatusId: string | null;
    movedPriority: number;
    movedIsCompleted: boolean;
  },
): Promise<MovedTaskSummary[]> {
  const siblingsResult = await client.query(
    `SELECT id, order_value, due_date, status_id, priority, is_completed FROM tasks
     WHERE collection_id = $1
       AND section_id IS NOT DISTINCT FROM $2
       AND parent_task_id IS NOT DISTINCT FROM $3
       AND id != $4
     ORDER BY order_value ASC, created_at ASC
     FOR UPDATE`,
    [opts.collectionId, opts.sectionId, opts.parentTaskId, opts.movedTaskId],
  );
  const siblings = siblingsResult.rows as {
    id: string;
    order_value: number;
    due_date: string | null;
    status_id: string | null;
    priority: number;
    is_completed: boolean;
  }[];

  const summarize = (
    task: {
      id: string;
      dueDate: string | null;
      statusId: string | null;
      priority: number;
      isCompleted: boolean;
    },
    orderValue: number,
  ): MovedTaskSummary => ({
    id: task.id,
    parentTaskId: opts.parentTaskId,
    collectionId: opts.collectionId,
    dueDate: task.dueDate,
    orderValue,
    depth: opts.depth,
    statusId: task.statusId,
    priority: task.priority,
    isCompleted: task.isCompleted,
  });

  const movedTask = {
    id: opts.movedTaskId,
    dueDate: opts.movedDueDate,
    statusId: opts.movedStatusId,
    priority: opts.movedPriority,
    isCompleted: opts.movedIsCompleted,
  };

  const clampedPosition = Math.min(opts.position, siblings.length);
  const prevValue = clampedPosition > 0 ? siblings[clampedPosition - 1].order_value : null;
  const nextValue = clampedPosition < siblings.length ? siblings[clampedPosition].order_value : null;
  const midpoint = midpointOrFallback(prevValue, nextValue);

  if (midpoint !== null) {
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      midpoint,
      opts.movedTaskId,
    ]);
    return [summarize(movedTask, midpoint)];
  }

  // Collision: the gap at the target slot has collapsed. Fall back to the
  // full splice-and-rewrite so every sibling stays 1000 apart again.
  const ordered = siblings.map((s) => ({
    id: s.id,
    dueDate: s.due_date,
    statusId: s.status_id,
    priority: s.priority,
    isCompleted: s.is_completed,
  }));
  ordered.splice(clampedPosition, 0, movedTask);

  const written: MovedTaskSummary[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const orderValue = i * 1000;
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      orderValue,
      ordered[i].id,
    ]);
    written.push(summarize(ordered[i], orderValue));
  }
  return written;
}

/**
 * Place a task at `position` within an order-table scope, gap-numbered. A midpoint
 * write for the moved task alone is only valid once both flanking neighbors
 * already carry a materialized `task_order` row for this scope - an unseeded
 * neighbor has no `position` to compute a midpoint from. Otherwise falls back
 * to seeding the whole scope from its current rendered order and rewriting it.
 * Returns the rows
 * actually written, mappable to `MovedTaskSummary` by the caller.
 */
async function renumberOrderTableScope(
  client: Client,
  opts: {
    userId: string;
    scopeType: 'day' | 'status' | 'priority';
    scopeId: string;
    collectionId: string;
    statusId: string | null;
    priority: number;
    movedTaskId: string;
    position: number;
    movedCollectionId: string;
    movedParentTaskId: string | null;
    movedDepth: number;
    movedOrderValue: number;
    movedDueDate: string | null;
    movedStatusId: string | null;
    movedPriority: number;
    movedIsCompleted: boolean;
  },
): Promise<MovedTaskSummary[]> {
  // Read every task in this scope, not only those already carrying a
  // position - a task that has never been dragged in Daily is seeded
  // alongside those that have. The LEFT JOIN's NULL `position` is also how a
  // seeded/unseeded neighbor is told apart for the fast-path check below.
  let membershipSql: string;
  let membershipParams: unknown[];
  if (opts.scopeType === 'day') {
    membershipSql = `t.due_date = $5::date`;
    membershipParams = [opts.scopeId];
  } else if (opts.scopeType === 'status') {
    membershipSql = `t.collection_id = $5 AND t.status_id IS NOT DISTINCT FROM $6::uuid`;
    membershipParams = [opts.collectionId, opts.statusId];
  } else {
    membershipSql = `t.collection_id = $5 AND t.priority = $6`;
    membershipParams = [opts.collectionId, opts.priority];
  }

  const result = await client.query(
    `SELECT t.id AS task_id,
            t.collection_id,
            t.parent_task_id,
            t.depth,
            t.order_value,
            t.due_date,
            t.status_id,
            t.priority,
            t.is_completed,
            o.position
     FROM tasks t
     LEFT JOIN task_order o
       ON o.task_id = t.id AND o.scope_type = $2 AND o.scope_id = $3
     WHERE t.user_id = $1 AND t.id != $4 AND ${membershipSql}
     ORDER BY o.position ASC NULLS LAST, t.order_value ASC, t.created_at ASC`,
    [opts.userId, opts.scopeType, opts.scopeId, opts.movedTaskId, ...membershipParams],
  );
  const siblings = result.rows as {
    task_id: string;
    collection_id: string;
    parent_task_id: string | null;
    depth: number;
    order_value: number;
    due_date: string | null;
    status_id: string | null;
    priority: number;
    is_completed: boolean;
    position: number | null | undefined;
  }[];

  // `orderValue` here always reports `tasks.order_value` - day-scope moves
  // only ever write `task_order.position`, never `tasks.order_value` - so
  // callers sorting a day's list (e.g. DailyPage) can compare it against
  // every other task's untouched `order_value` without a number-space clash.
  const summarize = (
    id: string,
    orderValue: number,
    collectionId: string,
    parentTaskId: string | null,
    depth: number,
    dueDate: string | null,
    statusId: string | null,
    priority: number,
    isCompleted: boolean,
  ): MovedTaskSummary => ({
    id,
    parentTaskId,
    collectionId,
    dueDate,
    orderValue,
    depth,
    statusId,
    priority,
    isCompleted,
  });

  const clampedPosition = Math.min(opts.position, siblings.length);
  const prevSibling = clampedPosition > 0 ? siblings[clampedPosition - 1] : null;
  const nextSibling = clampedPosition < siblings.length ? siblings[clampedPosition] : null;
  // Loose check: a real unseeded neighbor comes back as SQL NULL, but treat a
  // missing `position` the same way either side.
  const bothSeeded =
    (prevSibling === null || prevSibling.position != null) &&
    (nextSibling === null || nextSibling.position != null);

  if (bothSeeded) {
    const midpoint = midpointOrFallback(
      prevSibling ? prevSibling.position! : null,
      nextSibling ? nextSibling.position! : null,
    );
    if (midpoint !== null) {
      await client.query(
        `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (task_id, scope_type, scope_id)
         DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
        [opts.userId, opts.movedTaskId, opts.scopeType, opts.scopeId, midpoint],
      );
      return [
        summarize(
          opts.movedTaskId,
          midpoint,
          opts.movedCollectionId,
          opts.movedParentTaskId,
          opts.movedDepth,
          opts.movedDueDate,
          opts.movedStatusId,
          opts.movedPriority,
          opts.movedIsCompleted,
        ),
      ];
    }
  }

  // Fallback: seed from every task on this day and rewrite the whole list.
  const ids = siblings.map((s) => s.task_id);
  ids.splice(clampedPosition, 0, opts.movedTaskId);

  await client.query(
    `DELETE FROM task_order WHERE task_id = $1 AND scope_type = $2 AND scope_id = $3`,
    [opts.movedTaskId, opts.scopeType, opts.scopeId],
  );

  const byId = new Map(siblings.map((s) => [s.task_id, s]));
  const written: MovedTaskSummary[] = [];
  for (let i = 0; i < ids.length; i++) {
    const position = i * 1000;
    await client.query(
      `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (task_id, scope_type, scope_id)
       DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
      [opts.userId, ids[i], opts.scopeType, opts.scopeId, position],
    );
    const sib = byId.get(ids[i]);
    written.push(
      summarize(
        ids[i],
        position,
        sib ? sib.collection_id : opts.movedCollectionId,
        sib ? sib.parent_task_id : opts.movedParentTaskId,
        sib ? sib.depth : opts.movedDepth,
        sib ? sib.due_date : opts.movedDueDate,
        sib ? sib.status_id : opts.movedStatusId,
        sib ? sib.priority : opts.movedPriority,
        sib ? sib.is_completed : opts.movedIsCompleted,
      ),
    );
  }
  return written;
}

/** Add a task to the end of a day's list, if it is not already in it. */
async function appendToDayScope(
  client: Client,
  userId: string,
  taskId: string,
  date: string,
): Promise<void> {
  // $3 is both an inserted value and a WHERE comparand, so it needs an explicit
  // cast - Postgres otherwise deduces text in one position and varchar in the
  // other and rejects the statement.
  await client.query(
    `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
     SELECT $1::uuid, $2::uuid, 'day', $3::varchar,
            COALESCE(MAX(position), 0) + 1000
     FROM task_order WHERE user_id = $1::uuid AND scope_type = 'day' AND scope_id = $3::varchar
     ON CONFLICT (task_id, scope_type, scope_id) DO NOTHING`,
    [userId, taskId, date],
  );
}

export async function deleteTask(taskId: string, userId: string): Promise<{ success: true }> {
  const task = await verifyTaskAccess(taskId, userId);

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
    await client.query(
      `INSERT INTO activity_events (id, user_id, collection_id, entity_type, entity_id, event_type, before_data)
       VALUES ($1, $2, $3, 'task', $4, 'task_deleted', $5)`,
      [uuidv4(), userId, task.collection_id, taskId, JSON.stringify({ title: task.title })],
    );

    await client.query('COMMIT');
    publishEvent(
      buildEvent({
        entityType: 'task',
        eventType: 'deleted',
        entityId: taskId,
        userId,
        collectionId: task.collection_id,
      }),
    ).catch((err) => console.error('[sync] publish failed', err));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}

export interface ReorganizeMove {
  taskId: string;
  dueDate: string;
}

export async function reorganizeTasks(
  userId: string,
  moves: ReorganizeMove[],
): Promise<{ updated: number }> {
  // Validate input
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'moves', message: 'moves array must be non-empty' }],
    });
  }

  if (moves.length > 100) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'moves', message: 'moves array must not exceed 100 items' }],
    });
  }

  // Validate all dates are ISO 8601 format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const move of moves) {
    if (!dateRegex.test(move.dueDate)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: [
          {
            field: 'moves',
            message: `Invalid date format: ${move.dueDate}. Expected YYYY-MM-DD`,
          },
        ],
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all tasks to be moved, lock them, verify ownership and root status
    const taskIds = moves.map((m) => m.taskId);
    const tasksResult = await client.query(
      `SELECT t.* FROM tasks t
       WHERE t.id = ANY($1)
         AND (
           t.user_id = $2
           OR t.collection_id IN (
             SELECT collection_id FROM collaborators WHERE user_id = $2
           )
         )
       FOR UPDATE`,
      [taskIds, userId],
    );

    const fetchedTasks = tasksResult.rows as TaskRow[];

    // Verify all tasks were found
    if (fetchedTasks.length !== taskIds.length) {
      throw new AppError({
        code: 'NOT_FOUND',
        message: 'One or more tasks not found or not accessible',
        statusCode: 404,
      });
    }

    // Verify all tasks are root (no parent) and uncompleted
    for (const task of fetchedTasks) {
      if (task.parent_task_id !== null) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 400,
          details: [
            {
              field: 'moves',
              message: `Task ${task.id} is a subtask and cannot be reorganized`,
            },
          ],
        });
      }

      if (task.is_completed) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 400,
          details: [
            {
              field: 'moves',
              message: `Task ${task.id} is completed and cannot be reorganized`,
            },
          ],
        });
      }
    }

    // Update each root task and its descendants
    let updateCount = 0;
    const updatedTasks: TaskRow[] = [];

    for (const move of moves) {
      const task = fetchedTasks.find((t) => t.id === move.taskId);
      if (!task) continue;

      // Skip if date didn't actually change
      if (task.due_date === move.dueDate) {
        continue;
      }

      // Update root task
      await client.query(
        `UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2`,
        [move.dueDate, move.taskId],
      );

      // Update all descendants to inherit new due_date
      await client.query(
        `WITH RECURSIVE descendants AS (
           SELECT id FROM tasks WHERE parent_task_id = $1
           UNION ALL
           SELECT t.id FROM tasks t
           INNER JOIN descendants d ON t.parent_task_id = d.id
         )
         UPDATE tasks SET due_date = $2, updated_at = NOW()
         WHERE id IN (SELECT id FROM descendants)`,
        [move.taskId, move.dueDate],
      );

      updateCount++;

      // Fetch updated task for event publishing
      const updated = await client.query('SELECT * FROM tasks WHERE id = $1', [move.taskId]);
      updatedTasks.push(updated.rows[0] as TaskRow);
    }

    await client.query('COMMIT');

    // Publish events after transaction commit
    for (const updated of updatedTasks) {
      const [formatted] = await attachLabels([formatTask(updated)]);
      publishEvent(
        buildEvent({
          entityType: 'task',
          eventType: 'updated',
          entityId: formatted.id,
          userId,
          collectionId: formatted.collectionId,
          payload: formatted,
        }),
      ).catch((err) => console.error('[sync] publish failed', err));
    }

    return { updated: updateCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
