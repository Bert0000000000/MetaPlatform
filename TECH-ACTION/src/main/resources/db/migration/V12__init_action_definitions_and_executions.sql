CREATE TABLE action_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    action_id       VARCHAR(64) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    method          VARCHAR(20) NOT NULL,
    url             VARCHAR(2048) NOT NULL,
    headers         JSONB DEFAULT '{}'::jsonb,
    input_schema    JSONB NOT NULL,
    output_schema   JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version         INT NOT NULL DEFAULT 1,
    created_by      VARCHAR(64) NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, action_id),
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_action_def_tenant_status ON action_definitions (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_action_def_code ON action_definitions (tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    execution_id    VARCHAR(64) NOT NULL,
    action_id       VARCHAR(64) NOT NULL,
    action_code     VARCHAR(128) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    input           JSONB NOT NULL,
    output          JSONB,
    error_code      VARCHAR(10),
    error_message   TEXT,
    trace_id        VARCHAR(64) NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, execution_id)
);

CREATE INDEX idx_exec_tenant_status ON executions (tenant_id, status);
CREATE INDEX idx_exec_action ON executions (action_id, started_at DESC);
CREATE INDEX idx_exec_trace ON executions (trace_id);
