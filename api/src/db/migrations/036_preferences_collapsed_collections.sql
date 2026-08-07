ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS collapsed_collection_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
