CREATE TABLE task_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(64) NOT NULL DEFAULT '#adb9c1',
  is_done_like BOOLEAN NOT NULL DEFAULT false,
  order_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_statuses_color_format
    CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$')
);

CREATE UNIQUE INDEX idx_task_statuses_collection_name ON task_statuses(collection_id, LOWER(name));
CREATE INDEX idx_task_statuses_collection_order ON task_statuses(collection_id, order_value);

-- SET NULL, never CASCADE: deleting a column must not delete work.
ALTER TABLE tasks ADD COLUMN status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;
-- Where the task sat before completion moved it, so reopen returns it to its real column.
ALTER TABLE tasks ADD COLUMN previous_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_collection_status ON tasks(collection_id, status_id);
