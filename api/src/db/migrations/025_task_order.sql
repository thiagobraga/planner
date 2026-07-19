-- Manual drag ordering needs a task to hold more than one position at a time.
--
-- `tasks.order_value` is a single integer scoped to (collection_id, section_id,
-- parent_task_id). That works while a task is only ever hand-sorted inside its
-- own collection. It breaks as soon as Daily is also drag-sortable, for two
-- reasons:
--
--   1. Both views would write the same column, so reordering Today silently
--      rewrites the collection's order and vice versa.
--   2. Daily lists tasks from many collections in one date section, but
--      `order_value` only ranks within a single collection - two tasks in
--      different collections have no comparable position.
--
-- So positions move into their own table, keyed by the scope they belong to.
-- The same task can then hold one position per scope:
--
--   task-a | day | 2026-07-18 | 1000
--   task-b | day | 2026-07-18 | 2000
--
-- Collection ordering keeps using `tasks.order_value` for now - it already works
-- and the read paths depend on it. This table is deliberately shaped to absorb
-- that scope later (`scope_type = 'collection'`) without another migration.

CREATE TABLE task_order (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Which list this position is a position *in*.
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('day', 'collection')),

  -- The identity of that list: an ISO date (YYYY-MM-DD) for 'day', a collection
  -- UUID for 'collection'. Text because it holds two different key types; that
  -- costs a foreign key on the collection case, so collection rows are cleaned
  -- up by the move service rather than by cascade.
  scope_id VARCHAR(64) NOT NULL,

  -- Gap-based, matching the `index * 1000` convention taskService already uses,
  -- so a single insert between neighbours usually needs no renumbering.
  position INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A task holds at most one position per list.
  CONSTRAINT task_order_unique_scope UNIQUE (task_id, scope_type, scope_id)
);

-- A day section reads every task in one scope, in order. Covers the read path.
CREATE INDEX idx_task_order_scope ON task_order(user_id, scope_type, scope_id, position);

-- Moving or deleting a task touches every scope it appears in.
CREATE INDEX idx_task_order_task ON task_order(task_id);

-- Seed day positions from what Daily currently renders, so existing lists keep
-- their present order on first load instead of collapsing to an arbitrary one.
-- The ORDER BY mirrors viewService's today/upcoming queries.
INSERT INTO task_order (user_id, task_id, scope_type, scope_id, position)
SELECT
  user_id,
  id,
  'day',
  to_char(due_date, 'YYYY-MM-DD'),
  (ROW_NUMBER() OVER (
    PARTITION BY user_id, due_date
    ORDER BY priority ASC, order_value ASC, created_at ASC
  ))::int * 1000
FROM tasks
WHERE due_date IS NOT NULL;
