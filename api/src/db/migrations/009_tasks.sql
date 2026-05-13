CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority SMALLINT NOT NULL DEFAULT 4 CHECK (priority >= 1 AND priority <= 4),
  due_date DATE,
  due_time TIMETZ,
  due_timezone VARCHAR(100),
  recurrence_rule JSONB,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_value INTEGER NOT NULL DEFAULT 0,
  depth SMALLINT NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_project ON tasks(user_id, project_id) WHERE NOT is_completed;
CREATE INDEX idx_tasks_due_date ON tasks(user_id, due_date) WHERE NOT is_completed AND due_date IS NOT NULL;
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_section ON tasks(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
