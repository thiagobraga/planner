ALTER TABLE tasks ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'note'));
