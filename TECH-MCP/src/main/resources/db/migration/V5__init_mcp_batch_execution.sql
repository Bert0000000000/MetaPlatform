CREATE TABLE mcp_batch_execution (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    batch_id        VARCHAR(64) NOT NULL,
    tool_id         UUID NOT NULL,
    input           JSONB,
    output          JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_batch_batch_id ON mcp_batch_execution (tenant_id, batch_id);
CREATE INDEX idx_mcp_batch_status ON mcp_batch_execution (tenant_id, status);
