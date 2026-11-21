-- One row per Markdown import: what it read, what it created, and whether it
-- was undone. Additive only; older builds never read it.
CREATE TABLE import_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL CHECK (char_length(source_path) BETWEEN 1 AND 512),
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  root_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  sources JSONB NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone_at TIMESTAMPTZ
);

-- At most one live import per source path and user; an undone one frees the path.
CREATE UNIQUE INDEX import_manifests_live_source
  ON import_manifests (user_id, source_path)
  WHERE undone_at IS NULL;
