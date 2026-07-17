-- V3: MCP Tool Execution (P2-MCP-11)
-- Phase 2 Sprint 2：异步/批量执行记录

CREATE TABLE mcp_tool_execution (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    tool_id         UUID NOT NULL,
    input           TEXT,
    output          TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    duration_ms     BIGINT,
    error_message   TEXT,
    trace_id        VARCHAR(64) NOT NULL,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_tool_exec_tenant_status ON mcp_tool_execution (tenant_id, status);
CREATE INDEX idx_mcp_tool_exec_tool ON mcp_tool_execution (tool_id, started_at);
CREATE INDEX idx_mcp_tool_exec_trace ON mcp_tool_execution (trace_id);
