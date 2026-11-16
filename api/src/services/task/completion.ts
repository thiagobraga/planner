import { v4 as uuidv4 } from 'uuid';
import pool from '../../db/pool.js';
import { planNextOccurrence } from '../../engines/recurrenceEngine.js';
import type { RecurrenceRule } from '../../types/recurrence.js';
import type { TaskRow } from '../../types/task.js';
import { recordActivity } from '../activityService.js';
import { syncStatusToCompletion } from '../completionSync.js';
import { attachLabels } from '../labelService.js';
import { getUserTimezone, localDateInTimezone } from '../viewService.js';
import { verifyTaskAccess } from './access.js';
import { publishTaskEvent } from './events.js';
import { formatTask } from './format.js';

export async function completeTask(taskId: string, userId: string, now: Date = new Date()) {
  const task = await verifyTaskAccess(taskId, userId);

  // A rule past its `until` date yields no next occurrence: complete it like a one-off task.
  let nextDueDateObj = null;
  if (task.recurrence_rule && task.due_date) {
    const rule = task.recurrence_rule as RecurrenceRule;
    // Only a from-completion rule reads the completion day, so skip the preferences lookup otherwise.
    const timeZone = rule.fromCompletion ? await getUserTimezone(userId) : 'UTC';
    const completedOn = localDateInTimezone(now, timeZone);
    nextDueDateObj = planNextOccurrence(
      { date: task.due_date, time: task.due_time ?? undefined, timezone: task.due_timezone ?? undefined },
      rule,
      completedOn,
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Recurring task: clone with the next due date instead of mutating in-place
    if (nextDueDateObj) {
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
        `INSERT INTO tasks (id, user_id, collection_id, section_id, parent_task_id, title, description, priority, due_date, due_time, due_timezone, recurrence_rule, depth, type, order_value, deadline_date, deadline_time, deadline_timezone, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                 (SELECT deadline_date + ($9::date - due_date) FROM tasks WHERE id = $16), $17, $18, $19)
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
          taskId,
          task.deadline_time,
          task.deadline_timezone,
          task.duration_minutes,
        ],
      );

      // 3. Clone labels if any exist
      const labelsResult = await client.query(`SELECT label_id FROM task_labels WHERE task_id = $1`, [taskId]);
      if (labelsResult.rows.length > 0) {
        const placeholders = labelsResult.rows.map((_, i) => `($1, $${i + 2})`).join(', ');
        const values = [newId, ...labelsResult.rows.map((r) => r.label_id)];
        await client.query(`INSERT INTO task_labels (task_id, label_id) VALUES ${placeholders}`, values);
      }

      // Record activity event
      await recordActivity(client, {
        userId,
        collectionId: task.collection_id,
        entityType: 'task',
        entityId: taskId,
        eventType: 'task_completed',
        afterData: { recurring: true, nextTaskId: newId },
      });

      await syncStatusToCompletion(client, {
        taskId,
        userId,
        collectionId: task.collection_id,
        isCompleted: true,
      });

      await client.query('COMMIT');

      const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const [formattedOld] = await attachLabels([formatTask(updated.rows[0] as TaskRow)]);
      publishTaskEvent('updated', userId, formattedOld);

      const [formattedNew] = await attachLabels([formatTask(insertResult.rows[0] as TaskRow)]);
      publishTaskEvent('created', userId, formattedNew);

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
    await recordActivity(client, {
      userId,
      collectionId: task.collection_id,
      entityType: 'task',
      entityId: taskId,
      eventType: 'task_completed',
    });

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
    publishTaskEvent('completed', userId, formatted);
    return formatted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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
    await recordActivity(client, {
      userId,
      collectionId: task.collection_id,
      entityType: 'task',
      entityId: taskId,
      eventType: 'task_reopened',
    });

    await syncStatusToCompletion(client, {
      taskId,
      userId,
      collectionId: task.collection_id,
      isCompleted: false,
    });

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const [formatted] = await attachLabels([formatTask(updated.rows[0] as TaskRow)]);
    publishTaskEvent('uncompleted', userId, formatted);
    return formatted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
