-- Who acted: the web app (session) or an API token / OAuth grant on the user's
-- behalf. actor_label snapshots the token name so renaming or revoking the
-- token later does not rewrite history.
ALTER TABLE activity_events
  ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT 'session',
  ADD COLUMN api_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
  ADD COLUMN actor_label VARCHAR(100);

ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_actor_type_valid CHECK (actor_type IN ('session', 'token', 'oauth'));

CREATE INDEX idx_activity_token ON activity_events(api_token_id, created_at DESC)
  WHERE api_token_id IS NOT NULL;
CREATE INDEX idx_activity_user_agent ON activity_events(user_id, created_at DESC)
  WHERE actor_type <> 'session';
