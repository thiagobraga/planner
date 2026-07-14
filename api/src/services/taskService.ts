import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { buildEvent, publishEvent } from './syncService.js';
import { addDaysISO } from './viewService.js';

interface TaskRow {
  id: string;
  user_id: string;
  project_id: string;
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
    projectId: row.project_id,
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
         OR t.project_id IN (
           SELECT project_id FROM collaborators WHERE user_id = $2
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

    // Recurring task: compute next due date instead of completing
    if (task.recurrence_rule) {
      const nextDueDate = task.due_date ? addDaysISO(task.due_date, 1) : null;

      await client.query(
        `UPDATE tasks
         SET due_date = $1, updated_at = NOW()
         WHERE id = $2`,
        [nextDueDate, taskId],
      );

      // Record activity event
      await client.query(
        `INSERT INTO activity_events (user_id, project_id, entity_type, entity_id, event_type, after_data)
         VALUES ($1, $2, 'task', $3, 'task_completed', $4)`,
        [userId, task.project_id, taskId, JSON.stringify({ recurring: true, nextDueDate })],
      );

      await client.query('COMMIT');

      const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const formatted = formatTask(updated.rows[0] as TaskRow);
      publishEvent(
        buildEvent({
          entityType: 'task',
          eventType: 'updated',
          entityId: formatted.id,
          userId,
          projectId: formatted.projectId,
          payload: formatted,
        }),
      ).catch((err) => console.error('[sync] publish failed', err));
      return formatted;
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
      `INSERT INTO activity_events (user_id, project_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_completed')`,
      [userId, task.project_id, taskId],
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
        projectId: formatted.projectId,
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
  projectId?: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  labelIds?: string[];
  dueDate?: string | null;
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

  let projectId = input.projectId;
  let sectionId = input.sectionId ?? null;
  let depth = 0;

  if (input.parentTaskId) {
    // Verify parent exists and user has access
    const parentTask = await verifyTaskAccess(input.parentTaskId, userId);

    // Inherit parent's project_id and section_id
    projectId = parentTask.project_id;
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

  // If no project specified and no parent, use Inbox
  if (!projectId) {
    const inboxResult = await pool.query(
      `SELECT id FROM projects WHERE user_id = $1 AND is_inbox = true`,
      [userId],
    );
    projectId = inboxResult.rows[0]?.id;
  }

  // Verify user has access to project
  if (projectId) {
    const projectAccess = await pool.query(
      `SELECT id FROM projects
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT project_id FROM collaborators WHERE user_id = $2))`,
      [projectId, userId],
    );
    if (projectAccess.rows.length === 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Project not accessible',
        statusCode: 400,
        details: [{ field: 'projectId', message: 'Project not accessible' }],
      });
    }
  }

  const id = uuidv4();
  const priority = input.priority ?? 4;
  const type = input.type ?? 'task';

  const result = await pool.query(
    `INSERT INTO tasks (id, user_id, project_id, section_id, parent_task_id, title, description, priority, due_date, depth, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      userId,
      projectId,
      sectionId,
      input.parentTaskId ?? null,
      input.title,
      input.description ?? null,
      priority,
      input.dueDate ?? null,
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
      projectId: task.projectId,
      payload: task,
    }),
  ).catch((err) => console.error('[sync] publish failed', err));
  return task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: number;
  projectId?: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
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

      // Inherit parent's project_id and section_id
      setClauses.push(`project_id = $${paramIndex++}`);
      values.push(parentTask.project_id);
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

  if (input.projectId !== undefined && input.parentTaskId === undefined) {
    // Verify user has access to target project
    const projectAccess = await pool.query(
      `SELECT id FROM projects
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT project_id FROM collaborators WHERE user_id = $2))`,
      [input.projectId, userId],
    );
    if (projectAccess.rows.length === 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Project not accessible',
        statusCode: 400,
        details: [{ field: 'projectId', message: 'Project not accessible' }],
      });
    }

    setClauses.push(`project_id = $${paramIndex++}`);
    values.push(input.projectId);

    // Moving to different project clears section_id
    if (input.projectId !== task.project_id) {
      setClauses.push(`section_id = NULL`);
    }
  }

  if (
    input.sectionId !== undefined &&
    input.projectId === undefined &&
    input.parentTaskId === undefined
  ) {
    setClauses.push(`section_id = $${paramIndex++}`);
    values.push(input.sectionId);
  }

  if (input.dueDate !== undefined) {
    setClauses.push(`due_date = $${paramIndex++}`);
    values.push(input.dueDate);
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
      projectId: formatted.projectId,
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
      `INSERT INTO activity_events (user_id, project_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_reopened')`,
      [userId, task.project_id, taskId],
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
        projectId: formatted.projectId,
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

    // Get sibling tasks (same project + section + parent) ordered by current order_value
    const siblingsResult = await client.query(
      `SELECT id, order_value FROM tasks
       WHERE project_id = $1
         AND section_id IS NOT DISTINCT FROM $2
         AND parent_task_id IS NOT DISTINCT FROM $3
         AND id != $4
       ORDER BY order_value ASC`,
      [task.project_id, task.section_id, task.parent_task_id, taskId],
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
      `INSERT INTO activity_events (id, user_id, project_id, entity_type, entity_id, event_type, before_data)
       VALUES ($1, $2, $3, 'task', $4, 'task_deleted', $5)`,
      [uuidv4(), userId, task.project_id, taskId, JSON.stringify({ title: task.title })],
    );

    await client.query('COMMIT');
    publishEvent(
      buildEvent({
        entityType: 'task',
        eventType: 'deleted',
        entityId: taskId,
        userId,
        projectId: task.project_id,
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
