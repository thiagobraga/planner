-- Collection name uniqueness moves from global-per-user to scoped-per-parent, so
-- the same name can exist under different parents (e.g. "artwork" nested under
-- both "sociopata" and "revel") without colliding. Two partial indexes are needed
-- because NULL parent_id (top-level collections) never equals itself in a plain
-- unique index.
CREATE UNIQUE INDEX idx_collections_unique_name_per_parent
  ON collections (user_id, parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX idx_collections_unique_name_top_level
  ON collections (user_id, LOWER(name))
  WHERE parent_id IS NULL;
