-- V20: MCP Debug Breakpoint（P1 补齐）
-- 断点调试：为调试会话设置条件断点

CREATE TABLE mcp_debug_breakpoint (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    session_id      UUID NOT NULL,
    tool_id         UUID,
    condition       TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES mcp_debug_session(id)
);

CREATE INDEX idx_mcp_debug_breakpoint_session ON mcp_debug_breakpoint (session_id, created_at);
CREATE INDEX idx_mcp_debug_breakpoint_tenant ON mcp_debug_breakpoint (tenant_id);
