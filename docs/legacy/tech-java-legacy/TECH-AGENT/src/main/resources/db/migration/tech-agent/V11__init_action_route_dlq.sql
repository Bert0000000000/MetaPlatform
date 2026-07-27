-- V11__init_action_route_dlq.sql
-- P5.7 ActionRoute DLQ persistent storage.
-- Replaces the in-memory CopyOnWriteArrayList with a Postgres-backed queue
-- so failed auto-routes survive restarts and can be retried by background job.

CREATE TABLE IF NOT EXISTS action_route_dlq (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    run_id            VARCHAR(64) NOT NULL,
    proposal_id       VARCHAR(64) NOT NULL,
    action_code       VARCHAR(128) NOT NULL,
    risk_level        VARCHAR(16) NOT NULL,
    reason            TEXT NOT NULL,
    failed_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    retry_count       INT NOT NULL DEFAULT 0,
    last_retry_at     TIMESTAMP WITH TIME ZONE,
    resolved_at       TIMESTAMP WITH TIME ZONE,
    resolved_status   VARCHAR(32),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dlq_risk_level CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_dlq_resolved_status CHECK (resolved_status IS NULL OR resolved_status IN ('RETRIED','DISCARDED','SUCCESS','FAILED'))
);

CREATE INDEX idx_action_route_dlq_tenant ON action_route_dlq(tenant_id);
CREATE INDEX idx_action_route_dlq_unresolved ON action_route_dlq(tenant_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_action_route_dlq_run ON action_route_dlq(run_id);
CREATE INDEX idx_action_route_dlq_proposal ON action_route_dlq(proposal_id);

COMMENT ON TABLE action_route_dlq IS 'P5.7 DLQ for failed Action Guard auto-routes';
COMMENT ON COLUMN action_route_dlq.retry_count IS 'Number of retry attempts since enqueue';
COMMENT ON COLUMN action_route_dlq.resolved_at IS 'When the entry was successfully retried or discarded';
