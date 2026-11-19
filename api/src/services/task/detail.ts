import pool from '../../db/pool.js';
import type { TaskRow } from '../../types/task.js';
import { getAccessibleTask } from './access.js';
import { formatTask } from './format.js';

// Guards both walks against a corrupt parent cycle; real nesting is far shallower.
const MAX_HOPS = 64;

/**
 * One entry for the detail panel: the task, its parent chain for the
 * breadcrumb and its whole subtree, completed items included so progress
 * counts are exact whatever the list's hide-completed preference says.
 */
export async function getTaskDetail(taskId: string, userId: string) {
  const row = await getAccessibleTask(taskId, userId);
  const [ancestors, descendants] = await Promise.all([
    pool.query<{ id: string; title: string }>(
      `WITH RECURSIVE chain AS (
         SELECT id, title, parent_task_id, 0 AS hops FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id, t.title, t.parent_task_id, chain.hops + 1
         FROM tasks t JOIN chain ON t.id = chain.parent_task_id
         WHERE chain.hops < $2
       )
       SELECT id, title FROM chain WHERE hops > 0 ORDER BY hops DESC`,
      [row.id, MAX_HOPS],
    ),
    pool.query<TaskRow>(
      `WITH RECURSIVE tree AS (
         SELECT t.*, 1 AS hops FROM tasks t WHERE t.parent_task_id = $1 AND t.collection_id = $2
         UNION ALL
         SELECT t.*, tree.hops + 1 FROM tasks t JOIN tree ON t.parent_task_id = tree.id
         WHERE t.collection_id = $2 AND tree.hops < $3
       )
       SELECT * FROM tree ORDER BY hops, order_value, created_at`,
      [row.id, row.collection_id, MAX_HOPS],
    ),
  ]);
  return {
    task: formatTask(row),
    ancestors: ancestors.rows,
    descendants: descendants.rows.map(formatTask),
  };
}
