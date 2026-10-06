-- OAuth 2.1 for hosted MCP clients (claude.ai, ChatGPT connectors).
-- Planner is both the authorization server and the resource server (/api/v1/mcp).
-- Every code and token is stored as a SHA-256 hash, like sessions and API tokens.

-- Dynamically registered clients (RFC 7591). The SDK owns the metadata shape,
-- so it is kept whole as JSON.
CREATE TABLE oauth_clients (
  client_id   VARCHAR(255) PRIMARY KEY,
  client_name VARCHAR(200) NOT NULL,
  metadata    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A started /authorize call waiting for the user on the consent page.
CREATE TABLE oauth_authorization_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri   TEXT NOT NULL,
  code_challenge VARCHAR(128) NOT NULL,
  scopes         TEXT[] NOT NULL,
  state          TEXT,
  resource       TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL
);

-- What a user allowed one client to do. Revoking it kills every token under it.
CREATE TABLE oauth_grants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  scopes        TEXT[] NOT NULL,
  resource      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoke_reason VARCHAR(100),
  CONSTRAINT oauth_grants_scopes_valid CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'write']::TEXT[])
);
CREATE INDEX idx_oauth_grants_user_active ON oauth_grants(user_id) WHERE revoked_at IS NULL;

CREATE TABLE oauth_codes (
  code_hash      VARCHAR(64) PRIMARY KEY,
  grant_id       UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  redirect_uri   TEXT NOT NULL,
  code_challenge VARCHAR(128) NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ
);

CREATE TABLE oauth_tokens (
  token_hash VARCHAR(64) PRIMARY KEY,
  grant_id   UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  kind       VARCHAR(10) NOT NULL CHECK (kind IN ('access', 'refresh')),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Set when a refresh token is rotated; presenting it again means it leaked.
  used_at    TIMESTAMPTZ
);
CREATE INDEX idx_oauth_tokens_grant ON oauth_tokens(grant_id);

ALTER TABLE activity_events
  ADD COLUMN oauth_grant_id UUID REFERENCES oauth_grants(id) ON DELETE SET NULL;
