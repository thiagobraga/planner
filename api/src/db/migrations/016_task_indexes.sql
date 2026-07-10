-- Non-partial indexes for queries that include both completed and uncompleted tasks,
-- and ORDER BY priority / order_value / created_at for stable task ordering.

-- Covers getTodayView: WHERE user_id, due_date → ORDER BY priority, order_value, created_at
CREATE INDEX idx_tasks_user_due_date_ordered
  ON tasks(user_id, due_date, priority, order_value, created_at)
  WHERE due_date IS NOT NULL;

-- Covers getInboxView / getProjectView: WHERE user_id, project_id → ORDER BY order_value, created_at
CREATE INDEX idx_tasks_user_project_ordered
  ON tasks(user_id, project_id, order_value, created_at);

-- Non-partial counterpart to idx_tasks_user_project (was WHERE NOT is_completed)
-- so queries including completed tasks can still filter efficiently.
DROP INDEX IF EXISTS idx_tasks_user_project;
CREATE INDEX idx_tasks_user_project ON tasks(user_id, project_id);
