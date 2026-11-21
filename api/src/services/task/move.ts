import pool from '../../db/pool.js';
import { recordActivity } from '../activityService.js';
import type { MoveTaskInput, TaskRow } from '../../types/task.js';
import { getAccessibleTask } from './access.js';
import { publishSourceCollectionChange, publishTaskEvent } from './events.js';
import { formatTask, toMovedTaskSummary } from './format.js';
import { loadAndLockSubtree, resolveMoveDestination } from './moveDestination.js';
import { applySubtreeMove, renumberMoveScope } from './moveSubtree.js';
import { validateMoveInput } from './validation.js';

export { reorganizeTasks } from './reorganize.js';

/**
 * Structurally move a task, carrying its entire descendant subtree.
 *
 * Deliberately separate from `updateTask`: this rewrites tree position, list
 * membership and the ordering of everything around it, and every one of those
 * writes has to land together. A partial move - a reparented root whose children
 * kept the old depth, say - leaves the tree unrenderable, so the whole operation
 * is one transaction that rolls back intact.
 */
export async function moveTask(taskId: string, userId: string, input: MoveTaskInput, options?: { preserveParent: boolean }) {
  validateMoveInput(input);

  // Authenticate before resolving anything else, so an unauthorized caller
  // cannot probe which task or collection ids exist by reading error shapes.
  let task = await getAccessibleTask(taskId, userId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subtree = await loadAndLockSubtree(client, taskId);
    if (options?.preserveParent) {
      task = await getAccessibleTask(taskId, userId, client);
      input = { ...input, parentTaskId: task.parent_task_id };
    }
    const dest = await resolveMoveDestination(client, task, userId, input, subtree);
    const rootIsCompleted = await applySubtreeMove(client, task, userId, input, dest);
    const reordered = await renumberMoveScope(client, task, input, dest, rootIsCompleted);

    const fields = [
      ...(input.parentTaskId !== task.parent_task_id ? ['parentTaskId'] : []),
      ...(dest.crossesCollection ? ['collectionId'] : []),
      ...(dest.destSectionId !== task.section_id ? ['sectionId'] : []),
      ...(dest.crossesDate ? ['dueDate'] : []),
      ...(dest.statusChanged ? ['statusId'] : []),
      ...(dest.destPriority !== task.priority ? ['priority'] : []),
    ];
    if (fields.length > 0) {
      await recordActivity(client, {
        userId,
        collectionId: dest.destCollectionId,
        entityType: 'task',
        entityId: taskId,
        eventType: 'task_updated',
        afterData: { title: task.title, fields },
      });
    }
    await client.query('COMMIT');

    const movedResult = await pool.query(
      `SELECT t.*, o.position AS day_position
       FROM tasks t
       LEFT JOIN task_order o
         ON o.task_id = t.id
        AND o.scope_type = 'day'
        AND o.scope_id = to_char(t.due_date, 'YYYY-MM-DD')
       WHERE t.id = ANY($1::uuid[]) ORDER BY t.depth ASC, t.order_value ASC`,
      [dest.subtreeIds],
    );
    const movedTasks = (movedResult.rows as (TaskRow & { day_position: number | null })[]).map(
      (row) => ({ ...formatTask(row), dayPosition: row.day_position }),
    );
    const moved = movedTasks.map((taskRow) => ({
      ...toMovedTaskSummary(taskRow),
      orderValue: taskRow.dayPosition ?? taskRow.orderValue,
    }));

    const root = movedTasks.find((t) => t.id === taskId)!;
    // The payload must BE the task: every existing consumer reads it as one
    // (`apiToTask(event.payload as ApiTask)`). affectedIds rides alongside.
    publishTaskEvent('updated', userId, root, {
      ...root,
      affectedIds: [...dest.subtreeIds, ...reordered.map((t) => t.id)],
    });

    if (dest.crossesCollection) publishSourceCollectionChange(userId, taskId, task.collection_id);

    return { moved, reordered };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
