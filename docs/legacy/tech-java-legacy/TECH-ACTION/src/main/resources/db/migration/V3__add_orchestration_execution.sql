CREATE TABLE action_orchestration_execution (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          VARCHAR(64) NOT NULL,
    execution_id       VARCHAR(64) NOT NULL,
    orchestration_id   VARCHAR(64) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    node_states        JSONB NOT NULL DEFAULT '[]'::jsonb,
    input              JSONB,
    output             JSONB,
    error_message      TEXT,
    trace_id           VARCHAR(64) NOT NULL,
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    duration_ms        INT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, execution_id)
);

CREATE INDEX idx_orch_exec_tenant_status ON action_orchestration_execution (tenant_id, status);
CREATE INDEX idx_orch_exec_orch ON action_orchestration_execution (orchestration_id, started_at DESC);
CREATE INDEX idx_orch_exec_trace ON action_orchestration_execution (trace_id);
