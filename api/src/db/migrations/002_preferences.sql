CREATE TABLE preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  time_zone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  week_start VARCHAR(10) NOT NULL DEFAULT 'sunday',
  theme VARCHAR(10) NOT NULL DEFAULT 'system',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true
);
