ALTER TABLE habit_groups
  ADD COLUMN icon TEXT;

ALTER TABLE habit_groups
  ADD CONSTRAINT habit_groups_icon_length
  CHECK (icon IS NULL OR char_length(icon) BETWEEN 1 AND 16);
