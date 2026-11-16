import pool from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { syncCompletionToStatus } from '../completionSync.js';
import { attachLabels } from '../labelService.js';
import type {
  MovedTaskSummary,
  MoveTaskInput,
  ReorganizeMove,
  SubtreeRow,
  TaskRow,
} from '../../types/task.js';
import { verifyCollectionAccess, verifyTaskAccess } from './access.js';
import { publishTaskEvent } from './events.js';
import { formatTask, toMovedTaskSummary } from './format.js';
import {
  appendToDayScope,
  renumberCollectionScope,
  renumberOrderTableScope,
} from './ordering.js';
import {
  ISO_DATE,
  MAX_DEPTH,
  validateMoveInput,
  validationError,
} from './validation.js';

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

    // Resolve the destination ------------------------------------------------
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

    // Apply the move to the root ---------------------------------------------
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

    // Carry the descendants --------------------------------------------------
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

    // Update day membership --------------------------------------------------
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

    // Reposition within the target ordering scope ----------------------------
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
    } else {
      reordered = await renumberCollectionScope(client, {
        collectionId: destCollectionId,
        sectionId: destSectionId,
        parentTaskId: input.parentTaskId,
        movedTaskId: taskId,
        position: input.position,
        afterTaskId: input.afterTaskId,
        depth: rootNewDepth,
        movedDueDate: destDueDate,
        movedStatusId: destStatusId,
        movedPriority: destPriority,
        movedIsCompleted: rootIsCompleted,
      });
    }

    await client.query('COMMIT');

    // Report every record the client must patch ------------------------------
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
    const moved = movedTasks.map((taskRow) => ({
      ...toMovedTaskSummary(taskRow),
      orderValue: taskRow.dayPosition ?? taskRow.orderValue,
    }));

    const root = movedTasks.find((t) => t.id === taskId)!;
    // The payload must BE the task: every existing consumer reads it as one
    // (`apiToTask(event.payload as ApiTask)`). affectedIds rides alongside.
    publishTaskEvent('updated', userId, root, {
      ...root,
      affectedIds: [...subtreeIds, ...reordered.map((t) => t.id)],
    });

    return { moved, reordered };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

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
