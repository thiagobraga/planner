ALTER TABLE preferences
  ADD COLUMN nav_style TEXT NOT NULL DEFAULT 'icon-left'
  CHECK (nav_style IN ('text', 'icon-left', 'icon-top'));
