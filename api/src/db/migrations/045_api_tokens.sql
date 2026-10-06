-- Personal API tokens: bearer credentials for scripts and AI agents.
--
-- Same storage model as sessions (027): the raw token is shown to the user
-- once and only its SHA-256 hash is kept. token_prefix is a display-only
-- fragment so the user can tell their tokens apart in Settings.
CREATE TABLE api_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  token_prefix  VARCHAR(16) NOT NULL,
  token_hash    VARCHAR(64) NOT NULL UNIQUE,
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['read'],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoke_reason VARCHAR(100),
  CONSTRAINT api_tokens_scopes_valid CHECK (
    cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'write']::TEXT[]
  )
);

CREATE INDEX idx_api_tokens_user_active ON api_tokens(user_id) WHERE revoked_at IS NULL;
