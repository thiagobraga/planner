ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS daily_view JSONB NOT NULL DEFAULT '{"style":"notebook","range":"week"}'::jsonb,
  ADD COLUMN IF NOT EXISTS full_width BOOLEAN NOT NULL DEFAULT false;
