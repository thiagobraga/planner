-- Phase 2: Opaque server-side sessions.
--
-- Replace JWT-based sessions with opaque tokens: 32 random bytes sent only
-- in a cookie, SHA-256 hashed for storage. The raw token never reaches the
-- database.
--
-- Adds idle and absolute expiry, revocation tracking, last-seen timestamp,
-- and an internal serial ID for bounded-cadence touch queries.
--
-- WARNING: Invalidates all existing sessions (intentional one-time logout).

-- Add new columns alongside existing ones for a transitional period,
-- then drop the legacy columns in a follow-up migration after all
-- services use the new session model.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS token_hash_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idle_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sessions_token_sha256 ON sessions(token_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry_cleanup ON sessions(absolute_expires_at)
  WHERE revoked_at IS NULL AND absolute_expires_at IS NOT NULL;

-- Invalidate all legacy sessions; new sessions use the opaque model.
UPDATE sessions SET revoked_at = NOW(), revoke_reason = 'legacy-jwt-migration';
