ALTER TABLE preferences
  ADD COLUMN board_view_modes JSONB NOT NULL DEFAULT '{}'::jsonb;
