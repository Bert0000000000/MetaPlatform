-- V8: MCP Audit Log (P3-MCP-03)
-- Phase 3：调用审计（调用列表/详情/Token 统计/错误/趋势）

CREATE TABLE mcp_audit_log (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    tool_id         UUID,
    tool_code       VARCHAR(128),
    invocation_type VARCHAR(32),
    input_tokens    INT NOT NULL DEFAULT 0,
    output_tokens   INT NOT NULL DEFAULT 0,
    duration_ms     BIGINT NOT NULL,
    status          VARCHAR(32) NOT NULL,
    error_message   TEXT,
    trace_id        VARCHAR(64),
    user_id         VARCHAR(64),
    called_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_audit_tenant_called ON mcp_audit_log (tenant_id, called_at);
CREATE INDEX idx_mcp_audit_tool ON mcp_audit_log (tenant_id, tool_id, called_at);
CREATE INDEX idx_mcp_audit_status ON mcp_audit_log (tenant_id, status, called_at);
CREATE INDEX idx_mcp_audit_trace ON mcp_audit_log (trace_id);
