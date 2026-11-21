import type { PoolClient } from 'pg';
import { syncCompletionToStatus } from '../completionSync.js';
import type {
  MovedTaskSummary,
  MoveTaskInput,
  ResolvedMoveDestination,
  TaskRow,
} from '../../types/task.js';
import {
  appendToDayScope,
  renumberCollectionScope,
  renumberOrderTableScope,
} from './ordering.js';

export async function applySubtreeMove(
  client: PoolClient,
  task: TaskRow,
  userId: string,
  input: MoveTaskInput,
  dest: ResolvedMoveDestination,
): Promise<boolean> {
  const taskId = task.id;
  const {
    subtreeIds,
    rootNewDepth,
    depthDelta,
    destCollectionId,
    destSectionId,
    destDueDate,
    crossesCollection,
    crossesDate,
    destStatusId,
    statusChanged,
    destStatusIsCompletion,
  } = dest;

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

  return rootIsCompleted;
}

export async function renumberMoveScope(
  client: PoolClient,
  task: TaskRow,
  input: MoveTaskInput,
  dest: ResolvedMoveDestination,
  rootIsCompleted: boolean,
): Promise<MovedTaskSummary[]> {
  const {
    rootNewDepth,
    destCollectionId,
    destSectionId,
    destDueDate,
    destStatusId,
    destPriority,
  } = dest;

  if (input.scope.kind === 'day') {
    return renumberOrderTableScope(client, {
      userId: task.user_id,
      scopeType: 'day',
      scopeId: input.scope.dueDate,
      collectionId: destCollectionId,
      statusId: destStatusId,
      priority: destPriority,
      movedTaskId: task.id,
      position: input.position,
      afterTaskId: input.afterTaskId,
      movedCollectionId: destCollectionId,
      movedParentTaskId: input.parentTaskId,
      movedDepth: rootNewDepth,
      movedOrderValue: task.order_value,
      movedDueDate: destDueDate,
      movedStatusId: destStatusId,
      movedPriority: destPriority,
      movedIsCompleted: rootIsCompleted,
    });
  }

  if (input.scope.kind === 'status' || input.scope.kind === 'priority') {
    return renumberOrderTableScope(client, {
      userId: task.user_id,
      scopeType: input.scope.kind,
      scopeId:
        input.scope.kind === 'status'
          ? (input.scope.statusId ?? 'none')
          : String(input.scope.priority),
      collectionId: destCollectionId,
      statusId: destStatusId,
      priority: destPriority,
      movedTaskId: task.id,
      position: input.position,
      afterTaskId: input.afterTaskId,
      movedCollectionId: destCollectionId,
      movedParentTaskId: input.parentTaskId,
      movedDepth: rootNewDepth,
      movedOrderValue: task.order_value,
      movedDueDate: destDueDate,
      movedStatusId: destStatusId,
      movedPriority: destPriority,
      movedIsCompleted: rootIsCompleted,
    });
  }

  return renumberCollectionScope(client, {
    collectionId: destCollectionId,
    sectionId: destSectionId,
    parentTaskId: input.parentTaskId,
    movedTaskId: task.id,
    position: input.position,
    afterTaskId: input.afterTaskId,
    depth: rootNewDepth,
    movedDueDate: destDueDate,
    movedStatusId: destStatusId,
    movedPriority: destPriority,
    movedIsCompleted: rootIsCompleted,
  });
}
