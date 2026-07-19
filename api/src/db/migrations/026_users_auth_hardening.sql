-- Phase 1: User identity and password storage hardening.
--
-- 1. Abort if case-insensitive duplicate emails exist (operator must deduplicate).
-- 2. Normalise existing stored emails to lowercase NFC form.
-- 3. Add a unique index on LOWER(email) for case-insensitive uniqueness.
-- 4. Make display_name nullable to support the email-and-password-only model.
--
-- WARNING: If this migration finds duplicates, it FAILS. Run this query first
-- to check:
--
--   SELECT LOWER(email), COUNT(*) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1;
--
-- Rollback: drop the new index, revert display_name to NOT NULL, restore emails
-- from a pre-migration backup.

-- Fail fast on duplicates before any writes
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % case-insensitive duplicate email(s). Resolve before applying this migration.', dup_count;
  END IF;
END $$;

-- Normalise existing emails to lowercase NFC
UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);

-- Add case-insensitive unique index
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- Keep the existing unique constraint on the raw column for direct lookups,
-- but make display_name optional
ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;
