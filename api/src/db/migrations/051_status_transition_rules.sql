ALTER TABLE task_statuses
  ADD COLUMN next_status_mode VARCHAR(8) NOT NULL DEFAULT 'default'
    CHECK (next_status_mode IN ('default', 'custom', 'disabled')),
  ADD COLUMN next_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL,
  ADD COLUMN accept_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL,
  ADD COLUMN reject_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

CREATE INDEX idx_task_statuses_next_status ON task_statuses(next_status_id) WHERE next_status_id IS NOT NULL;
CREATE INDEX idx_task_statuses_accept_status ON task_statuses(accept_status_id) WHERE accept_status_id IS NOT NULL;
CREATE INDEX idx_task_statuses_reject_status ON task_statuses(reject_status_id) WHERE reject_status_id IS NOT NULL;
