-- "Projects" is Todoist vocabulary inherited from this app's origins. The app is a
-- Bullet Journal, where the term is Collections. Renaming the storage layer too so
-- the vocabulary is consistent rather than a UI veneer over `project` internals.
--
-- Postgres carries indexes, constraints and foreign keys through a table rename
-- automatically, but their *names* keep the old text, so they are renamed here too.

ALTER TABLE projects RENAME TO collections;
ALTER TABLE project_invitations RENAME TO collection_invitations;

ALTER TABLE collaborators           RENAME COLUMN project_id TO collection_id;
ALTER TABLE collection_invitations  RENAME COLUMN project_id TO collection_id;
ALTER TABLE sections                RENAME COLUMN project_id TO collection_id;
ALTER TABLE tasks                   RENAME COLUMN project_id TO collection_id;
ALTER TABLE activity_events         RENAME COLUMN project_id TO collection_id;

ALTER INDEX idx_projects_user             RENAME TO idx_collections_user;
ALTER INDEX idx_tasks_user_project        RENAME TO idx_tasks_user_collection;
ALTER INDEX idx_tasks_user_project_ordered RENAME TO idx_tasks_user_collection_ordered;
ALTER INDEX idx_activity_project          RENAME TO idx_activity_collection;
ALTER INDEX projects_pkey                 RENAME TO collections_pkey;
ALTER INDEX project_invitations_pkey      RENAME TO collection_invitations_pkey;
ALTER INDEX project_invitations_token_hash_key RENAME TO collection_invitations_token_hash_key;
ALTER INDEX collaborators_project_id_user_id_key RENAME TO collaborators_collection_id_user_id_key;

ALTER TABLE collections            RENAME CONSTRAINT projects_parent_id_fkey TO collections_parent_id_fkey;
ALTER TABLE collections            RENAME CONSTRAINT projects_user_id_fkey TO collections_user_id_fkey;
ALTER TABLE collaborators          RENAME CONSTRAINT collaborators_project_id_fkey TO collaborators_collection_id_fkey;
ALTER TABLE collection_invitations RENAME CONSTRAINT project_invitations_project_id_fkey TO collection_invitations_collection_id_fkey;
ALTER TABLE sections               RENAME CONSTRAINT sections_project_id_fkey TO sections_collection_id_fkey;
ALTER TABLE tasks                  RENAME CONSTRAINT tasks_project_id_fkey TO tasks_collection_id_fkey;
ALTER TABLE activity_events        RENAME CONSTRAINT activity_events_project_id_fkey TO activity_events_collection_id_fkey;
