ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS show_notes BOOLEAN NOT NULL DEFAULT true;

UPDATE preferences SET show_notes = NOT hide_old_notes;

ALTER TABLE preferences
  DROP COLUMN IF EXISTS hide_old_notes;
