CREATE TABLE IF NOT EXISTS user_saved_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT user_saved_colors_format
    CHECK (color ~* '^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$')
);

CREATE INDEX IF NOT EXISTS user_saved_colors_user_id_idx
  ON user_saved_colors(user_id, created_at DESC);
