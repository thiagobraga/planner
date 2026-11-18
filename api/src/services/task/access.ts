import type { PoolClient } from 'pg';
import pool from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import type { TaskRow } from '../../types/task.js';

export async function getAccessibleTask(taskId: string, userId: string, db: PoolClient | typeof pool = pool): Promise<TaskRow> {
  const result = await db.query(
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

export async function requireCollectionRow(collectionId: string, userId: string): Promise<void> {
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
