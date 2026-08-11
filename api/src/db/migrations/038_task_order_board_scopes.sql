ALTER TABLE task_order DROP CONSTRAINT task_order_scope_type_check;

ALTER TABLE task_order ADD CONSTRAINT task_order_scope_type_check
  CHECK (scope_type IN ('day', 'collection', 'status', 'priority'));
