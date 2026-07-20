-- Phase 2 follow-up: let the opaque session model actually insert a row.
--
-- 027 added the opaque columns alongside the legacy ones and left the legacy
-- ones in place "for a transitional period". But sessions.token_hash and
-- sessions.expires_at are NOT NULL with no default, and createSession only
-- writes the opaque columns - so every login failed on a not-null violation
-- the moment 027 was applied. Nobody could log in.
--
-- Relax the constraints rather than dropping the columns. Dropping them is the
-- right end state and 027 says so, but that is irreversible and belongs with
-- the rest of the legacy-session cleanup, once nothing reads them.
--
-- The UNIQUE constraint on token_hash is left alone: Postgres allows repeated
-- NULLs in a unique index, so it does not block the new inserts.

ALTER TABLE sessions
  ALTER COLUMN token_hash DROP NOT NULL,
  ALTER COLUMN expires_at DROP NOT NULL;
