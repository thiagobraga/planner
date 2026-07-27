ALTER TABLE users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD CONSTRAINT users_role_valid CHECK (role IN ('user', 'admin'));

ALTER TABLE users
  ADD COLUMN disabled_at TIMESTAMPTZ;

-- Admin user listing filters and sorts on these; both stay cheap as the table grows.
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

-- No admin is seeded here. Grant the first one by hand:
--   UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER('you@example.com');
