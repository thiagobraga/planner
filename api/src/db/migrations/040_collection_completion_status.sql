ALTER TABLE collections ADD COLUMN completion_status_id UUID;

UPDATE collections c
SET completion_status_id = selected.id
FROM (
  SELECT DISTINCT ON (collection_id) collection_id, id
  FROM task_statuses
  -- Preserve the first configured done-like status. Legacy boards with none
  -- use their last column, matching the seeded Completed position.
  ORDER BY collection_id,
           is_done_like DESC,
           CASE WHEN is_done_like THEN order_value END ASC NULLS LAST,
           CASE WHEN NOT is_done_like THEN order_value END DESC NULLS LAST,
           id ASC
) selected
WHERE selected.collection_id = c.id;

ALTER TABLE task_statuses
  ADD CONSTRAINT task_statuses_collection_id_id_key UNIQUE (collection_id, id);

ALTER TABLE collections
  ADD CONSTRAINT collections_completion_status_same_collection_fkey
  FOREIGN KEY (id, completion_status_id)
  REFERENCES task_statuses(collection_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE task_statuses DROP COLUMN is_done_like;
