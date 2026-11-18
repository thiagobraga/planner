import pool from "../db/pool.js";
import type { ViewTaskRow } from "../types/task.js";

export async function findDailyTasks(
  userId: string,
  today: string,
  from: string,
  to: string,
  hideCompletedTasks: boolean,
  showNotes: boolean,
): Promise<ViewTaskRow[]> {
  // Day positions are separate from collection order; undragged tasks use collection order.
  const result = await pool.query<ViewTaskRow>(
    `SELECT t.id, t.user_id, t.collection_id, t.section_id, t.parent_task_id, t.assignee_user_id, t.title, t.description, t.priority, t.due_date, t.due_time, t.due_timezone, t.deadline_date, t.deadline_time, t.deadline_timezone, t.duration_minutes, t.recurrence_rule, t.is_completed, t.completed_at, t.depth, t.type, t.status_id, t.created_at, t.updated_at, COALESCE(o.position, t.order_value) AS effective_order_value,
            p.name AS collection_name, p.color AS collection_color, p.is_inbox AS collection_is_inbox, s.name AS section_name
     FROM tasks t
     JOIN collections p ON p.id = t.collection_id
     LEFT JOIN sections s ON s.id = t.section_id
     LEFT JOIN task_order o
       ON o.task_id = t.id
      AND o.scope_type = 'day'
      AND o.scope_id = to_char(t.due_date, 'YYYY-MM-DD')
     WHERE t.user_id = $1
       AND t.due_date IS NOT NULL
       AND (t.due_date < $2::date OR (t.due_date >= $3::date AND t.due_date <= $4::date))
       AND p.is_archived = false
       AND ($5::boolean = false OR t.is_completed = false)
       AND ($6::boolean = true OR NOT (t.type = 'note'))
     ORDER BY t.due_date ASC, o.position ASC NULLS LAST, t.order_value ASC, t.created_at ASC`,
    [userId, today, from, to, hideCompletedTasks, showNotes],
  );
  return result.rows;
}
