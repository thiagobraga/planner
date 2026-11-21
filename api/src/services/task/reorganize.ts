import pool from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { attachLabels } from '../labelService.js';
import type { ReorganizeMove, TaskRow } from '../../types/task.js';
import { publishTaskEvent } from './events.js';
import { formatTask } from './format.js';
import { ISO_DATE, validationError } from './validation.js';

export async function reorganizeTasks(
  userId: string,
  moves: ReorganizeMove[],
): Promise<{ updated: number }> {
  if (!Array.isArray(moves) || moves.length === 0) {
    throw validationError('moves', 'moves array must be non-empty');
  }

  if (moves.length > 100) {
    throw validationError('moves', 'moves array must not exceed 100 items');
  }

  for (const move of moves) {
    if (!ISO_DATE.test(move.dueDate)) {
      throw validationError('moves', `Invalid date format: ${move.dueDate}. Expected YYYY-MM-DD`);
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

    if (fetchedTasks.length !== taskIds.length) {
      throw new AppError({
        code: 'NOT_FOUND',
        message: 'One or more tasks not found or not accessible',
        statusCode: 404,
      });
    }

    for (const task of fetchedTasks) {
      if (task.parent_task_id !== null) {
        throw validationError('moves', `Task ${task.id} is a subtask and cannot be reorganized`);
      }

      if (task.is_completed) {
        throw validationError('moves', `Task ${task.id} is completed and cannot be reorganized`);
      }
    }

    let updateCount = 0;
    const updatedTasks: TaskRow[] = [];

    for (const move of moves) {
      const task = fetchedTasks.find((t) => t.id === move.taskId);
      if (!task) continue;

      if (task.due_date === move.dueDate) {
        continue;
      }

      await client.query(
        `UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2`,
        [move.dueDate, move.taskId],
      );

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

      const updated = await client.query('SELECT * FROM tasks WHERE id = $1', [move.taskId]);
      updatedTasks.push(updated.rows[0] as TaskRow);
    }

    await client.query('COMMIT');

    for (const updated of updatedTasks) {
      const [formatted] = await attachLabels([formatTask(updated)]);
      publishTaskEvent('updated', userId, formatted);
    }

    return { updated: updateCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
