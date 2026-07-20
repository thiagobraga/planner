import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { buildEvent, publishEvent } from './syncService.js';
import { addDaysISO } from './viewService.js';
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

      await client.query('COMMIT');

      const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const formattedOld = formatTask(updated.rows[0] as TaskRow);
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

      const formattedNew = formatTask(insertResult.rows[0] as TaskRow);
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

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const formatted = formatTask(updated.rows[0] as TaskRow);
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

  const result = await pool.query(
    `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, recurrence_rule, depth, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
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
    ],
  );

  const task = formatTask(result.rows[0] as TaskRow);
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

  if (setClauses.length === 0) {
    return formatTask(task);
  }

  setClauses.push(`updated_at = NOW()`);

  values.push(taskId);
  const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  // When reparenting shifts the task's own depth, the entire descendant subtree
  // must shift by the same delta so relative nesting is preserved (Phase 6 rule 5).
  const shiftsDescendants = reparentDelta !== undefined && reparentDelta !== 0;

  let formatted;
  if (shiftsDescendants) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(query, values);
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
      await client.query('COMMIT');
      formatted = formatTask(result.rows[0] as TaskRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const result = await pool.query(query, values);
    formatted = formatTask(result.rows[0] as TaskRow);
  }

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

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const formatted = formatTask(updated.rows[0] as TaskRow);
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
  | { kind: 'day'; dueDate: string };

export interface MoveTaskInput {
  parentTaskId: string | null;
  collectionId?: string;
  dueDate?: string | null;
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
    input.dueDate !== undefined &&
    input.dueDate !== null &&
    !ISO_DATE.test(input.dueDate)
  ) {
    throw validationError('dueDate', 'Due date must be an ISO date (YYYY-MM-DD)');
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
  } else {
    throw validationError('scope.kind', "Ordering scope must be 'collection' or 'day'");
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
    const destSectionId = destParent ? destParent.section_id : null;

    if (!destParent && input.collectionId && input.collectionId !== task.collection_id) {
      await verifyCollectionAccess(input.collectionId, userId);
    }

    // `undefined` keeps the current date - that is what makes a sidebar drop
    // file a dated task into a collection without knocking it off its day.
    const destDueDate = input.dueDate === undefined ? task.due_date : input.dueDate;

    const crossesCollection = destCollectionId !== task.collection_id;
    const crossesDate = destDueDate !== task.due_date;

    // ── Apply the move to the root ─────────────────────────────────────────────
    await client.query(
      `UPDATE tasks
       SET parent_task_id = $1,
           collection_id = $2,
           section_id = $3,
           due_date = $4,
           depth = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [input.parentTaskId, destCollectionId, destSectionId, destDueDate, rootNewDepth, taskId],
    );

    // ── Carry the descendants ──────────────────────────────────────────────────
    // Their parent links and relative order are untouched; only the values that
    // are inherited from the root shift. Completion, priority, labels,
    // recurrence and content are never written here.
    const descendantIds = subtreeIds.filter((id) => id !== taskId);
    if (descendantIds.length > 0) {
      if (depthDelta !== 0) {
        await client.query(
          `UPDATE tasks SET depth = depth + $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [depthDelta, descendantIds],
        );
      }
      if (crossesCollection) {
        // Sections belong to a collection, so a section id cannot survive the
        // crossing; descendants land unsectioned under their new collection.
        await client.query(
          `UPDATE tasks SET collection_id = $1, section_id = NULL, updated_at = NOW()
           WHERE id = ANY($2::uuid[])`,
          [destCollectionId, descendantIds],
        );
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
      if (task.due_date) {
        await normalizeDayScope(client, task.user_id, task.due_date);
      }
    }

    // ── Reposition within the target ordering scope ────────────────────────────
    if (input.scope.kind === 'collection') {
      await renumberCollectionScope(client, {
        collectionId: destCollectionId,
        sectionId: destSectionId,
        parentTaskId: input.parentTaskId,
        movedTaskId: taskId,
        position: input.position,
      });
    } else {
      await renumberDayScope(client, {
        userId: task.user_id,
        date: input.scope.dueDate,
        movedTaskId: taskId,
        position: input.position,
      });
    }

    // The source list closes the gap the task left behind, but only when it is a
    // different list - otherwise this would undo the renumbering just applied.
    const sourceDiffers =
      crossesCollection ||
      (task.parent_task_id ?? null) !== (input.parentTaskId ?? null) ||
      (task.section_id ?? null) !== (destSectionId ?? null);
    if (sourceDiffers) {
      await normalizeCollectionScope(client, {
        collectionId: task.collection_id,
        sectionId: task.section_id,
        parentTaskId: task.parent_task_id,
      });
    }

    await client.query('COMMIT');

    // ── Report every record the client must patch ──────────────────────────────
    const movedResult = await pool.query(
      `SELECT * FROM tasks WHERE id = ANY($1::uuid[]) ORDER BY depth ASC, order_value ASC`,
      [subtreeIds],
    );
    const moved = (movedResult.rows as TaskRow[]).map(formatTask);

    const reorderedResult = await pool.query(
      `SELECT DISTINCT t.* FROM tasks t
       LEFT JOIN task_order o ON o.task_id = t.id AND o.scope_type = 'day'
       WHERE t.id <> ALL($1::uuid[])
         AND (
           (t.collection_id = $2 AND t.section_id IS NOT DISTINCT FROM $3
              AND t.parent_task_id IS NOT DISTINCT FROM $4)
           OR (t.collection_id = $5 AND t.section_id IS NOT DISTINCT FROM $6
              AND t.parent_task_id IS NOT DISTINCT FROM $7)
           OR o.scope_id = ANY($8::varchar[])
         )`,
      [
        subtreeIds,
        destCollectionId,
        destSectionId,
        input.parentTaskId,
        task.collection_id,
        task.section_id,
        task.parent_task_id,
        [destDueDate, task.due_date].filter(Boolean),
      ],
    );
    const reordered = (reorderedResult.rows as TaskRow[]).map(formatTask);

    const root = moved.find((t) => t.id === taskId)!;
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

/** Place `movedTaskId` at `position` among its new siblings, gap-numbered. */
async function renumberCollectionScope(
  client: Client,
  opts: {
    collectionId: string;
    sectionId: string | null;
    parentTaskId: string | null;
    movedTaskId: string;
    position: number;
  },
): Promise<void> {
  const siblingsResult = await client.query(
    `SELECT id FROM tasks
     WHERE collection_id = $1
       AND section_id IS NOT DISTINCT FROM $2
       AND parent_task_id IS NOT DISTINCT FROM $3
       AND id != $4
     ORDER BY order_value ASC, created_at ASC
     FOR UPDATE`,
    [opts.collectionId, opts.sectionId, opts.parentTaskId, opts.movedTaskId],
  );
  const ids = (siblingsResult.rows as { id: string }[]).map((r) => r.id);
  ids.splice(Math.min(opts.position, ids.length), 0, opts.movedTaskId);

  for (let i = 0; i < ids.length; i++) {
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      i * 1000,
      ids[i],
    ]);
  }
}

/** Close gaps left in a list a task moved out of, preserving relative order. */
async function normalizeCollectionScope(
  client: Client,
  opts: { collectionId: string; sectionId: string | null; parentTaskId: string | null },
): Promise<void> {
  const result = await client.query(
    `SELECT id FROM tasks
     WHERE collection_id = $1
       AND section_id IS NOT DISTINCT FROM $2
       AND parent_task_id IS NOT DISTINCT FROM $3
     ORDER BY order_value ASC, created_at ASC
     FOR UPDATE`,
    [opts.collectionId, opts.sectionId, opts.parentTaskId],
  );
  const ids = (result.rows as { id: string }[]).map((r) => r.id);
  for (let i = 0; i < ids.length; i++) {
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      i * 1000,
      ids[i],
    ]);
  }
}

/** Place a task at `position` within one day's list, gap-numbered. */
async function renumberDayScope(
  client: Client,
  opts: { userId: string; date: string; movedTaskId: string; position: number },
): Promise<void> {
  // Seed from every task on this day, not only those already carrying a day
  // position. The first drag into a day would otherwise renumber a list of one
  // and rank the moved task above tasks it was dropped below - they hold no
  // position to compare against. Reading the day in its current rendered order
  // and writing the whole list back is what makes the first drag stick.
  const result = await client.query(
    `SELECT t.id AS task_id
     FROM tasks t
     LEFT JOIN task_order o
       ON o.task_id = t.id AND o.scope_type = 'day' AND o.scope_id = $2
     WHERE t.user_id = $1 AND t.due_date = $2::date AND t.id != $3
     ORDER BY o.position ASC NULLS LAST, t.order_value ASC, t.created_at ASC`,
    [opts.userId, opts.date, opts.movedTaskId],
  );
  const ids = (result.rows as { task_id: string }[]).map((r) => r.task_id);
  ids.splice(Math.min(opts.position, ids.length), 0, opts.movedTaskId);

  await client.query(
    `DELETE FROM task_order WHERE task_id = $1 AND scope_type = 'day' AND scope_id = $2`,
    [opts.movedTaskId, opts.date],
  );

  for (let i = 0; i < ids.length; i++) {
    await client.query(
      `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
       VALUES ($1, $2, 'day', $3, $4)
       ON CONFLICT (task_id, scope_type, scope_id)
       DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
      [opts.userId, ids[i], opts.date, i * 1000],
    );
  }
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

/** Close gaps in a day's list after tasks left it. */
async function normalizeDayScope(client: Client, userId: string, date: string): Promise<void> {
  const result = await client.query(
    `SELECT task_id FROM task_order
     WHERE user_id = $1 AND scope_type = 'day' AND scope_id = $2
     ORDER BY position ASC
     FOR UPDATE`,
    [userId, date],
  );
  const ids = (result.rows as { task_id: string }[]).map((r) => r.task_id);
  for (let i = 0; i < ids.length; i++) {
    await client.query(
      `UPDATE task_order SET position = $1, updated_at = NOW()
       WHERE task_id = $2 AND scope_type = 'day' AND scope_id = $3`,
      [i * 1000, ids[i], date],
    );
  }
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
