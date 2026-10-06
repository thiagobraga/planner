-- Opt-in toast when an API token (an AI agent) changes the user's tasks.
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS agent_change_notices BOOLEAN NOT NULL DEFAULT false;
