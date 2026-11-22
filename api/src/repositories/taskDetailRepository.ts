import pool from "../db/pool.js";
import type { TaskRow } from "../types/task.js";

// Guards both walks against a corrupt parent cycle; real nesting is far shallower.
const MAX_HOPS = 16;

export type DetailItemRow = Pick<
  TaskRow,
  | "id"
  | "parent_task_id"
  | "collection_id"
  | "section_id"
  | "title"
  | "type"
  | "is_completed"
  | "status_id"
  | "priority"
  | "due_date"
  | "deadline_date"
  | "order_value"
  | "depth"
>;

export interface TaskDetailMetaRow {
  collection_name: string;
  status_name: string | null;
  status_color: string | null;
}

const DETAIL_COLUMNS =
  "t.id, t.parent_task_id, t.collection_id, t.section_id, t.title, t.type, t.is_completed, t.status_id, t.priority, t.due_date, t.deadline_date, t.order_value, t.depth, t.created_at";

export async function findTaskAncestors(
  taskId: string,
  parentTaskId: string,
  collectionId: string,
): Promise<Array<{ id: string; title: string }>> {
  const result = await pool.query<{ id: string; title: string }>(
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
    [taskId, parentTaskId, collectionId, MAX_HOPS],
  );
  return result.rows;
}

export async function findTaskDescendants(taskId: string, collectionId: string): Promise<DetailItemRow[]> {
  const result = await pool.query<DetailItemRow>(
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
    [taskId, collectionId, MAX_HOPS],
  );
  return result.rows;
}

export async function findTaskDetailMeta(
  collectionId: string,
  statusId: string | null,
): Promise<TaskDetailMetaRow | undefined> {
  const result = await pool.query<TaskDetailMetaRow>(
    `SELECT c.name AS collection_name, s.name AS status_name, s.color AS status_color
     FROM collections c
     LEFT JOIN task_statuses s ON s.id = $2 AND s.collection_id = c.id
     WHERE c.id = $1`,
    [collectionId, statusId],
  );
  return result.rows[0];
}
