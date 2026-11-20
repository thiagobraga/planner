import pool from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import type { TaskRow, UpdateTaskInput } from '../../types/task.js';
import { recordActivity } from '../activityService.js';
import { attachLabels, verifyLabelOwnership } from '../labelService.js';
import { assertDescriptionWritable } from '../document/store.js';
import { getAccessibleTask } from './access.js';
import { publishSourceCollectionChange, publishTaskEvent } from './events.js';
import { formatTask } from './format.js';
import { MAX_DEPTH, validateTaskScalarFields, validateTimeNeedsDate, validationError } from './validation.js';

// Recorded on task_updated so the activity feed can say what changed; listed
// explicitly because the route hands over the raw request body.
const UPDATE_FIELDS: (keyof UpdateTaskInput)[] = [
  'title', 'description', 'priority', 'collectionId', 'sectionId', 'parentTaskId',
  'dueDate', 'dueTime', 'dueTimezone', 'deadlineDate', 'deadlineTime', 'deadlineTimezone',
  'durationMinutes', 'recurrenceRule', 'labelIds', 'type',
];

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
  validateTaskScalarFields({
    title: input.title,
    priority: input.priority,
    type: input.type,
  });

  await verifyLabelOwnership(input.labelIds ?? [], userId);
  const task = await getAccessibleTask(taskId, userId);
  if (input.description !== undefined) await assertDescriptionWritable(taskId);
  validateTimeNeedsDate(
    input,
    input.dueDate !== undefined ? input.dueDate : task.due_date,
    input.deadlineDate !== undefined ? input.deadlineDate : task.deadline_date,
  );

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
      const parentTask = await getAccessibleTask(input.parentTaskId, userId);

      // Cycle detection: walk up parent chain from proposed parent
      await detectCycle(taskId, input.parentTaskId);

      const newDepth = parentTask.depth + 1;
      if (newDepth > MAX_DEPTH) {
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
      if (newDepth + depthDelta > MAX_DEPTH) {
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
    const collectionAccess = await pool.query(
      `SELECT id FROM collections
       WHERE id = $1
         AND (user_id = $2 OR id IN (SELECT collection_id FROM collaborators WHERE user_id = $2))`,
      [input.collectionId, userId],
    );
    if (collectionAccess.rows.length === 0) {
      throw validationError('collectionId', 'Collection not accessible');
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

  if (input.dueTime !== undefined) {
    setClauses.push(`due_time = $${paramIndex++}`, `due_timezone = $${paramIndex++}`);
    values.push(input.dueTime, input.dueTime ? input.dueTimezone ?? null : null);
  } else if (input.dueDate === null) {
    setClauses.push(`due_time = NULL`, `due_timezone = NULL`);
  }

  if (input.deadlineDate !== undefined) {
    setClauses.push(`deadline_date = $${paramIndex++}`);
    values.push(input.deadlineDate);
  }

  if (input.deadlineTime !== undefined) {
    setClauses.push(`deadline_time = $${paramIndex++}`, `deadline_timezone = $${paramIndex++}`);
    values.push(input.deadlineTime, input.deadlineTime ? input.deadlineTimezone ?? null : null);
  } else if (input.deadlineDate === null) {
    setClauses.push(`deadline_time = NULL`, `deadline_timezone = NULL`);
  }

  if (input.durationMinutes !== undefined) {
    setClauses.push(`duration_minutes = $${paramIndex++}`);
    values.push(input.durationMinutes);
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
  const needsTransaction = shiftsDescendants || input.labelIds !== undefined || input.description !== undefined;

  let taskRow: TaskRow;
  if (needsTransaction) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (input.description !== undefined) {
        await client.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [taskId]);
        await assertDescriptionWritable(taskId, client);
      }
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
  await recordActivity(pool, {
    userId,
    collectionId: formatted.collectionId,
    entityType: 'task',
    entityId: formatted.id,
    eventType: 'task_updated',
    afterData: { title: formatted.title, fields: UPDATE_FIELDS.filter((field) => input[field] !== undefined) },
  });
  publishTaskEvent('updated', userId, formatted);
  if (formatted.collectionId !== task.collection_id) {
    publishSourceCollectionChange(userId, taskId, task.collection_id);
  }
  return formatted;
}

async function detectCycle(taskId: string, proposedParentId: string): Promise<void> {
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
