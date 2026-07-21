-- V12: MCP Debug Session (V13-04)
-- 调试器三栏布局 + 高级调试：断点、历史、回放、对比

CREATE TABLE mcp_debug_session (
    id                  UUID PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    server_id           UUID,
    tool_id             UUID,
    method              VARCHAR(128),
    request_payload     TEXT,
    response_payload    TEXT,
    raw_request         TEXT,
    raw_response        TEXT,
    duration_ms         BIGINT,
    status              VARCHAR(20) NOT NULL,
    error_message       TEXT,
    breakpoint          BOOLEAN NOT NULL DEFAULT FALSE,
    trace_id            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_debug_session_tenant_created ON mcp_debug_session (tenant_id, created_at DESC);
CREATE INDEX idx_mcp_debug_session_tool ON mcp_debug_session (tool_id, created_at DESC);
CREATE INDEX idx_mcp_debug_session_trace ON mcp_debug_session (trace_id);
