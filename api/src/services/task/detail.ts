import pool from '../../db/pool.js';
import type { TaskDetailDto, TaskDetailItem } from '../../contracts/taskDetail.js';
import type { TaskRow } from '../../types/task.js';
import { getAccessibleTask } from './access.js';
import { readTaskClaim } from './claim.js';

// Guards both walks against a corrupt parent cycle; real nesting is far shallower.
const MAX_HOPS = 16;

type DetailItemRow = Pick<
  TaskRow,
  | 'id'
  | 'parent_task_id'
  | 'collection_id'
  | 'section_id'
  | 'title'
  | 'type'
  | 'is_completed'
  | 'status_id'
  | 'priority'
  | 'due_date'
  | 'deadline_date'
  | 'order_value'
  | 'depth'
>;

const DETAIL_COLUMNS =
  't.id, t.parent_task_id, t.collection_id, t.section_id, t.title, t.type, t.is_completed, t.status_id, t.priority, t.due_date, t.deadline_date, t.order_value, t.depth, t.created_at';

function formatDetailItem(row: DetailItemRow): TaskDetailItem {
  return {
    id: row.id,
    parentTaskId: row.parent_task_id,
    collectionId: row.collection_id,
    sectionId: row.section_id,
    title: row.title,
    type: row.type as TaskDetailItem['type'],
    isCompleted: row.is_completed,
    statusId: row.status_id,
    priority: row.priority,
    dueDate: row.due_date,
    deadlineDate: row.deadline_date instanceof Date ? row.deadline_date.toISOString() : row.deadline_date,
    orderValue: row.order_value,
    depth: row.depth,
  };
}

/**
 * One entry for the detail panel: the task, its parent chain for the
 * breadcrumb and its whole subtree, completed items included so progress
 * counts are exact whatever the list's hide-completed preference says.
 */
export async function getTaskDetail(taskId: string, userId: string): Promise<TaskDetailDto> {
  const row = await getAccessibleTask(taskId, userId);
  const ancestorsPromise = row.parent_task_id
    ? pool.query<{ id: string; title: string }>(
        `WITH RECURSIVE chain AS (
           SELECT t.id, t.title, t.parent_task_id, 1 AS hops, ARRAY[$1::uuid, t.id] AS visited
           FROM tasks t
           WHERE t.id = $2 AND t.collection_id = $3
           UNION ALL
           SELECT t.id, t.title, t.parent_task_id, chain.hops + 1, chain.visited || t.id
           FROM tasks t JOIN chain ON t.id = chain.parent_task_id
           WHERE t.collection_id = $3 AND chain.hops < $4 AND NOT (t.id = ANY(chain.visited))
         )
         SELECT id, title FROM chain ORDER BY hops DESC`,
        [row.id, row.parent_task_id, row.collection_id, MAX_HOPS],
      )
    : Promise.resolve({ rows: [] as Array<{ id: string; title: string }> });

  const descendantsPromise = pool.query<DetailItemRow>(
    `WITH RECURSIVE tree AS (
       SELECT ${DETAIL_COLUMNS}, 1 AS hops, ARRAY[$1::uuid, t.id] AS visited
       FROM tasks t
       WHERE t.parent_task_id = $1 AND t.collection_id = $2
       UNION ALL
       SELECT ${DETAIL_COLUMNS}, tree.hops + 1, tree.visited || t.id
       FROM tasks t JOIN tree ON t.parent_task_id = tree.id
       WHERE t.collection_id = $2 AND tree.hops < $3 AND NOT (t.id = ANY(tree.visited))
     )
     SELECT * FROM tree ORDER BY hops, order_value, created_at, id`,
    [row.id, row.collection_id, MAX_HOPS],
  );

  const [ancestors, descendants, claim] = await Promise.all([ancestorsPromise, descendantsPromise, readTaskClaim(row.id)]);
  return {
    task: formatDetailItem(row),
    ancestors: ancestors.rows,
    descendants: descendants.rows.map(formatDetailItem),
    claim: claim && { label: claim.label, actorType: claim.actorType, claimedAt: claim.claimedAt, expiresAt: claim.expiresAt },
  };
}
