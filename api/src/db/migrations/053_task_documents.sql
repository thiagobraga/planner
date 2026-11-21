-- One rich document body per task or note (Tiptap/ProseMirror JSON).
-- tasks.description stays as the derived plain-text projection, so builds that
-- predate this table keep reading and searching it unchanged.
CREATE TABLE task_documents (
  task_id UUID PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
