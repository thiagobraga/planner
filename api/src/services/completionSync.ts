import type { PoolClient } from "pg";

// The single place is_completed and is_done_like reconcile. Its own module to
// avoid a taskService <-> statusService import cycle: both call in, neither
// is called back.

export interface SyncCompletionToStatusParams {
  taskId: string;
  userId: string;
  statusId: string | null;
  collectionId: string;
}

export type CompletionSyncResult = "completed" | "reopened" | null;

// A task now sits in `statusId` - reconcile is_completed to match whether that
// column is done-like. Takes an open client so it runs inside the caller's
// transaction (moveTask, statusService.updateStatus).
export async function syncCompletionToStatus(
  client: PoolClient,
  params: SyncCompletionToStatusParams,
): Promise<CompletionSyncResult> {
  const { taskId, userId, statusId, collectionId } = params;
  if (!statusId) return null;

  const statusResult = await client.query(`SELECT is_done_like FROM task_statuses WHERE id = $1`, [statusId]);
  const isDoneLike = Boolean(statusResult.rows[0]?.is_done_like);

  const taskResult = await client.query(`SELECT is_completed FROM tasks WHERE id = $1`, [taskId]);
  const isCompleted = Boolean(taskResult.rows[0]?.is_completed);

  if (isDoneLike && !isCompleted) {
    await client.query(
      `UPDATE tasks SET is_completed = true, completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [taskId],
    );

    // Cascade: mark all subtasks complete too, same recursive CTE as completeTask.
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

    await client.query(
      `INSERT INTO activity_events (user_id, collection_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_completed')`,
      [userId, collectionId, taskId],
    );

    return "completed";
  }

  if (!isDoneLike && isCompleted) {
    await client.query(
      `UPDATE tasks SET is_completed = false, completed_at = NULL, updated_at = NOW() WHERE id = $1`,
      [taskId],
    );

    await client.query(
      `INSERT INTO activity_events (user_id, collection_id, entity_type, entity_id, event_type)
       VALUES ($1, $2, 'task', $3, 'task_reopened')`,
      [userId, collectionId, taskId],
    );

    return "reopened";
  }

  return null;
}

export interface SyncStatusToCompletionParams {
  taskId: string;
  userId: string;
  collectionId: string;
  isCompleted: boolean;
  includeDescendants?: boolean;
}

// Completion just changed on this task by another path (completeTask,
// reopenTask) - move it to the matching status column.
export async function syncStatusToCompletion(
  client: PoolClient,
  params: SyncStatusToCompletionParams,
): Promise<void> {
  const { taskId, collectionId, isCompleted, includeDescendants = false } = params;

  const taskResult = await client.query(
    `SELECT status_id, previous_status_id FROM tasks WHERE id = $1`,
    [taskId],
  );
  const row = taskResult.rows[0] as { status_id: string | null; previous_status_id: string | null } | undefined;
  if (!row) return;

  if (isCompleted) {
    const doneLikeResult = await client.query(
      `SELECT id FROM task_statuses WHERE collection_id = $1 AND is_done_like = true ORDER BY order_value ASC LIMIT 1`,
      [collectionId],
    );
    const doneLikeId = doneLikeResult.rows[0]?.id as string | undefined;
    if (!doneLikeId) return;

    if (includeDescendants) {
      await client.query(
        `WITH RECURSIVE affected AS (
           SELECT id, status_id FROM tasks WHERE id = $1
           UNION ALL
           SELECT t.id, t.status_id FROM tasks t
           INNER JOIN affected a ON t.parent_task_id = a.id
         )
         UPDATE tasks t
         SET previous_status_id = a.status_id,
             status_id = $2,
             updated_at = NOW()
         FROM affected a
         WHERE t.id = a.id AND t.status_id IS DISTINCT FROM $2`,
        [taskId, doneLikeId],
      );
    } else {
      await client.query(
        `UPDATE tasks
         SET previous_status_id = status_id, status_id = $1, updated_at = NOW()
         WHERE id = $2 AND status_id IS DISTINCT FROM $1`,
        [doneLikeId, taskId],
      );
    }
  } else {
    let targetStatusId = row.previous_status_id;
    if (!targetStatusId) {
      const fallbackResult = await client.query(
        `SELECT id FROM task_statuses WHERE collection_id = $1 AND is_done_like = false ORDER BY order_value ASC LIMIT 1`,
        [collectionId],
      );
      targetStatusId = (fallbackResult.rows[0]?.id as string | undefined) ?? null;
    }

    await client.query(
      `UPDATE tasks SET status_id = $1, previous_status_id = NULL, updated_at = NOW() WHERE id = $2`,
      [targetStatusId, taskId],
    );
  }
}
