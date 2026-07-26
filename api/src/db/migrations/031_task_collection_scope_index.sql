-- Covers renumberCollectionScope's sibling lookup: WHERE collection_id, section_id,
-- parent_task_id → ORDER BY order_value, created_at
CREATE INDEX idx_tasks_collection_scope_ordered
  ON tasks(collection_id, section_id, parent_task_id, order_value, created_at);
