ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS deadline_date DATE,
  ADD COLUMN IF NOT EXISTS deadline_time TIMETZ,
  ADD COLUMN IF NOT EXISTS deadline_timezone VARCHAR(100),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440));
