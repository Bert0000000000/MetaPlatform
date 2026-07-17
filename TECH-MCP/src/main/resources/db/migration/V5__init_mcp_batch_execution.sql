-- V5: MCP Batch Execution (P2-MCP-11)
-- Phase 2 Sprint 2：批量执行记录

CREATE TABLE mcp_batch_execution (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    batch_id        VARCHAR(64) NOT NULL,
    tool_id         UUID NOT NULL,
    input           TEXT,
    output          TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message   TEXT,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_batch_batch_id ON mcp_batch_execution (tenant_id, batch_id);
CREATE INDEX idx_mcp_batch_status ON mcp_batch_execution (tenant_id, status);
