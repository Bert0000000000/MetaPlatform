CREATE TABLE mcp_tool_execution (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    tool_id         UUID NOT NULL,
    input           JSONB,
    output          JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    duration_ms     BIGINT,
    error_message   TEXT,
    trace_id        VARCHAR(64) NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_tool_exec_tenant_status ON mcp_tool_execution (tenant_id, status);
CREATE INDEX idx_mcp_tool_exec_tool ON mcp_tool_execution (tool_id, started_at DESC);
CREATE INDEX idx_mcp_tool_exec_trace ON mcp_tool_execution (trace_id);
