CREATE TABLE habit_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_habit_groups_user ON habit_groups(user_id, order_value, created_at);

-- Sub-habits: one level deep. Deleting a parent removes its children, and the
-- existing habit_completions cascade removes their completions.
ALTER TABLE habits ADD COLUMN parent_id UUID REFERENCES habits(id) ON DELETE CASCADE;

-- Deleting a group ungroups its habits rather than destroying them.
ALTER TABLE habits ADD COLUMN group_id UUID REFERENCES habit_groups(id) ON DELETE SET NULL;

ALTER TABLE habits DROP COLUMN note;

-- A child belongs to its parent's group implicitly, so it never carries its own.
ALTER TABLE habits ADD CONSTRAINT habits_child_has_no_group
  CHECK (parent_id IS NULL OR group_id IS NULL);

CREATE INDEX idx_habits_parent ON habits(parent_id);
