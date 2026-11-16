import type { PoolClient } from 'pg';
import pool from '../../db/pool.js';
import type {
  MovedTaskSummary,
  RenumberCollectionScopeOptions,
  RenumberOrderTableScopeOptions,
  TaskRow,
} from '../../types/task.js';
import { getAccessibleTask } from './access.js';
import { formatTask } from './format.js';
import { validationError } from './validation.js';

type Client = PoolClient;

/** Where in `siblingIds` a moved task is inserted: right after `afterTaskId` when given, else `position` clamped. */
export function resolveInsertIndex(siblingIds: string[], position: number, afterTaskId?: string | null): number {
  if (afterTaskId === undefined) return Math.min(position, siblingIds.length);
  if (afterTaskId === null) return 0;
  const index = siblingIds.indexOf(afterTaskId);
  if (index === -1) throw validationError('afterTaskId', 'After task is not in the target list');
  return index + 1;
}

/**
 * The order value that sits strictly between two flanking siblings (or beyond
 * a missing side, following the existing 1000-unit gap convention: siblings
 * are spaced ~1000 apart and the first sits near 0), or `null` if the gap has
 * collapsed and there is no integer room left - e.g. adjacent values `0` and
 * `1`, or prepending before a sibling already sitting at `0`.
 */
export function midpointOrFallback(prev: number | null, next: number | null): number | null {
  if (prev === null && next === null) return 0;
  if (prev === null) {
    const candidate = next! - 1000;
    return candidate >= 0 ? candidate : null;
  }
  if (next === null) return prev + 1000;
  const mid = Math.floor((prev + next) / 2);
  return mid > prev && mid < next ? mid : null;
}

/**
 * Place `movedTaskId` at `position` among its new siblings, gap-numbered.
 * Siblings are already spaced ~1000 apart, so the common case is a single
 * midpoint write for the moved task alone; only a collapsed gap falls back to
 * renumbering the whole list. Returns the rows actually written, mappable to
 * `MovedTaskSummary` by the caller without a second query.
 */
export async function renumberCollectionScope(
  client: Client,
  opts: RenumberCollectionScopeOptions,
): Promise<MovedTaskSummary[]> {
  const siblingsResult = await client.query(
    `SELECT id, order_value, due_date, status_id, priority, is_completed FROM tasks
     WHERE collection_id = $1
       AND section_id IS NOT DISTINCT FROM $2
       AND parent_task_id IS NOT DISTINCT FROM $3
       AND id != $4
     ORDER BY order_value ASC, created_at ASC
     FOR UPDATE`,
    [opts.collectionId, opts.sectionId, opts.parentTaskId, opts.movedTaskId],
  );
  const siblings = siblingsResult.rows as {
    id: string;
    order_value: number;
    due_date: string | null;
    status_id: string | null;
    priority: number;
    is_completed: boolean;
  }[];

  const summarize = (
    task: {
      id: string;
      dueDate: string | null;
      statusId: string | null;
      priority: number;
      isCompleted: boolean;
    },
    orderValue: number,
  ): MovedTaskSummary => ({
    id: task.id,
    parentTaskId: opts.parentTaskId,
    collectionId: opts.collectionId,
    dueDate: task.dueDate,
    orderValue,
    depth: opts.depth,
    statusId: task.statusId,
    priority: task.priority,
    isCompleted: task.isCompleted,
  });

  const movedTask = {
    id: opts.movedTaskId,
    dueDate: opts.movedDueDate,
    statusId: opts.movedStatusId,
    priority: opts.movedPriority,
    isCompleted: opts.movedIsCompleted,
  };

  const clampedPosition = resolveInsertIndex(
    siblings.map((sib) => sib.id),
    opts.position,
    opts.afterTaskId,
  );
  const prevValue = clampedPosition > 0 ? siblings[clampedPosition - 1].order_value : null;
  const nextValue = clampedPosition < siblings.length ? siblings[clampedPosition].order_value : null;
  const midpoint = midpointOrFallback(prevValue, nextValue);

  if (midpoint !== null) {
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      midpoint,
      opts.movedTaskId,
    ]);
    return [summarize(movedTask, midpoint)];
  }

  // Collision: the gap at the target slot has collapsed. Fall back to the
  // full splice-and-rewrite so every sibling stays 1000 apart again.
  const ordered = siblings.map((s) => ({
    id: s.id,
    dueDate: s.due_date,
    statusId: s.status_id,
    priority: s.priority,
    isCompleted: s.is_completed,
  }));
  ordered.splice(clampedPosition, 0, movedTask);

  const written: MovedTaskSummary[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const orderValue = i * 1000;
    await client.query(`UPDATE tasks SET order_value = $1, updated_at = NOW() WHERE id = $2`, [
      orderValue,
      ordered[i].id,
    ]);
    written.push(summarize(ordered[i], orderValue));
  }
  return written;
}

/**
 * Place a task at `position` within an order-table scope, gap-numbered. A midpoint
 * write for the moved task alone is only valid once both flanking neighbors
 * already carry a materialized `task_order` row for this scope - an unseeded
 * neighbor has no `position` to compute a midpoint from. Otherwise falls back
 * to seeding the whole scope from its current rendered order and rewriting it.
 * Returns the rows actually written, mappable to `MovedTaskSummary` by the caller.
 */
export async function renumberOrderTableScope(
  client: Client,
  opts: RenumberOrderTableScopeOptions,
): Promise<MovedTaskSummary[]> {
  // Read every task in this scope, not only those already carrying a
  // position - a task that has never been dragged in Daily is seeded
  // alongside those that have. The LEFT JOIN's NULL `position` is also how a
  // seeded/unseeded neighbor is told apart for the fast-path check below.
  let membershipSql: string;
  let membershipParams: unknown[];
  if (opts.scopeType === 'day') {
    membershipSql = `t.due_date = $5::date`;
    membershipParams = [opts.scopeId];
  } else if (opts.scopeType === 'status') {
    membershipSql = `t.collection_id = $5 AND t.status_id IS NOT DISTINCT FROM $6::uuid`;
    membershipParams = [opts.collectionId, opts.statusId];
  } else {
    membershipSql = `t.collection_id = $5 AND t.priority = $6`;
    membershipParams = [opts.collectionId, opts.priority];
  }

  const result = await client.query(
    `SELECT t.id AS task_id,
            t.collection_id,
            t.parent_task_id,
            t.depth,
            t.order_value,
            t.due_date,
            t.status_id,
            t.priority,
            t.is_completed,
            o.position
     FROM tasks t
     LEFT JOIN task_order o
       ON o.task_id = t.id AND o.scope_type = $2 AND o.scope_id = $3
     WHERE t.user_id = $1 AND t.id != $4 AND ${membershipSql}
     ORDER BY o.position ASC NULLS LAST, t.order_value ASC, t.created_at ASC`,
    [opts.userId, opts.scopeType, opts.scopeId, opts.movedTaskId, ...membershipParams],
  );
  const siblings = result.rows as {
    task_id: string;
    collection_id: string;
    parent_task_id: string | null;
    depth: number;
    order_value: number;
    due_date: string | null;
    status_id: string | null;
    priority: number;
    is_completed: boolean;
    position: number | null | undefined;
  }[];

  // `orderValue` here always reports `tasks.order_value` - day-scope moves
  // only ever write `task_order.position`, never `tasks.order_value` - so
  // callers sorting a day's list (e.g. DailyPage) can compare it against
  // every other task's untouched `order_value` without a number-space clash.
  const summarize = (
    id: string,
    orderValue: number,
    collectionId: string,
    parentTaskId: string | null,
    depth: number,
    dueDate: string | null,
    statusId: string | null,
    priority: number,
    isCompleted: boolean,
  ): MovedTaskSummary => ({
    id,
    parentTaskId,
    collectionId,
    dueDate,
    orderValue,
    depth,
    statusId,
    priority,
    isCompleted,
  });

  const clampedPosition = resolveInsertIndex(
    siblings.map((sib) => sib.task_id),
    opts.position,
    opts.afterTaskId,
  );
  const prevSibling = clampedPosition > 0 ? siblings[clampedPosition - 1] : null;
  const nextSibling = clampedPosition < siblings.length ? siblings[clampedPosition] : null;
  // Loose check: a real unseeded neighbor comes back as SQL NULL, but treat a
  // missing `position` the same way either side.
  const bothSeeded =
    (prevSibling === null || prevSibling.position != null) &&
    (nextSibling === null || nextSibling.position != null);

  if (bothSeeded) {
    const midpoint = midpointOrFallback(
      prevSibling ? prevSibling.position! : null,
      nextSibling ? nextSibling.position! : null,
    );
    if (midpoint !== null) {
      await client.query(
        `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (task_id, scope_type, scope_id)
         DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
        [opts.userId, opts.movedTaskId, opts.scopeType, opts.scopeId, midpoint],
      );
      return [
        summarize(
          opts.movedTaskId,
          midpoint,
          opts.movedCollectionId,
          opts.movedParentTaskId,
          opts.movedDepth,
          opts.movedDueDate,
          opts.movedStatusId,
          opts.movedPriority,
          opts.movedIsCompleted,
        ),
      ];
    }
  }

  // Fallback: seed from every task on this day and rewrite the whole list.
  const ids = siblings.map((s) => s.task_id);
  ids.splice(clampedPosition, 0, opts.movedTaskId);

  await client.query(
    `DELETE FROM task_order WHERE task_id = $1 AND scope_type = $2 AND scope_id = $3`,
    [opts.movedTaskId, opts.scopeType, opts.scopeId],
  );

  const byId = new Map(siblings.map((s) => [s.task_id, s]));
  const written: MovedTaskSummary[] = [];
  for (let i = 0; i < ids.length; i++) {
    const position = i * 1000;
    await client.query(
      `INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (task_id, scope_type, scope_id)
       DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
      [opts.userId, ids[i], opts.scopeType, opts.scopeId, position],
    );
    const sib = byId.get(ids[i]);
    written.push(
      summarize(
        ids[i],
        position,
        sib ? sib.collection_id : opts.movedCollectionId,
        sib ? sib.parent_task_id : opts.movedParentTaskId,
        sib ? sib.depth : opts.movedDepth,
        sib ? sib.due_date : opts.movedDueDate,
        sib ? sib.status_id : opts.movedStatusId,
        sib ? sib.priority : opts.movedPriority,
        sib ? sib.is_completed : opts.movedIsCompleted,
      ),
    );
  }
  return written;
}

/** Add a task to the end of a day's list, if it is not already in it. */
export async function appendToDayScope(
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

export async function reorderTask(taskId: string, userId: string, position: number) {
  if (!Number.isInteger(position) || position < 0) {
    throw validationError('position', 'Position must be a non-negative integer');
  }

  const task = await getAccessibleTask(taskId, userId);

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
