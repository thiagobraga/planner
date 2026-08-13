-- Task Statuses: per-collection workflow columns.
-- Model: completion is derived from task.status_id === collection.completion_status_id.
-- Incorporates what was originally planned as migration 040_collection_completion_status.sql
-- to ensure the model is complete from creation.

CREATE TABLE task_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(64) NOT NULL DEFAULT '#adb9c1',
  order_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_statuses_color_format
    CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$')
);

CREATE UNIQUE INDEX idx_task_statuses_collection_name ON task_statuses(collection_id, LOWER(name));
CREATE INDEX idx_task_statuses_collection_order ON task_statuses(collection_id, order_value);

-- Add completion_status_id to collections.
-- At most one status per collection represents task completion.
-- When a collection has no completion_status_id, no task can be marked complete in it.
ALTER TABLE collections ADD COLUMN completion_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

-- Add status columns to tasks.
-- status_id: the current workflow column this task lives in.
-- previous_status_id: where the task was before completion moved it (for reopening).
-- Foreign keys are to task_statuses(id), which itself references collections(id).
-- Collection-scoping is enforced by trigger validate_task_statuses_collection.
ALTER TABLE tasks ADD COLUMN status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN previous_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

-- Trigger: enforce that status_id and previous_status_id belong to the task's collection.
CREATE OR REPLACE FUNCTION validate_task_statuses_collection()
RETURNS TRIGGER AS $$
DECLARE
  status_collection_id UUID;
  prev_status_collection_id UUID;
BEGIN
  -- Check status_id if set.
  IF NEW.status_id IS NOT NULL THEN
    SELECT collection_id INTO status_collection_id FROM task_statuses WHERE id = NEW.status_id;
    IF status_collection_id IS NULL THEN
      RAISE EXCEPTION 'Status % does not exist', NEW.status_id;
    END IF;
    IF status_collection_id != NEW.collection_id THEN
      RAISE EXCEPTION 'Status % does not belong to collection %', NEW.status_id, NEW.collection_id;
    END IF;
  END IF;

  -- Check previous_status_id if set.
  IF NEW.previous_status_id IS NOT NULL THEN
    SELECT collection_id INTO prev_status_collection_id FROM task_statuses WHERE id = NEW.previous_status_id;
    IF prev_status_collection_id IS NULL THEN
      RAISE EXCEPTION 'Previous status % does not exist', NEW.previous_status_id;
    END IF;
    IF prev_status_collection_id != NEW.collection_id THEN
      RAISE EXCEPTION 'Previous status % does not belong to collection %', NEW.previous_status_id, NEW.collection_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_task_statuses_collection
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_statuses_collection();

-- Index for collection + status queries.
CREATE INDEX idx_tasks_collection_status ON tasks(collection_id, status_id);
CREATE INDEX idx_tasks_collection_previous_status ON tasks(collection_id, previous_status_id);
