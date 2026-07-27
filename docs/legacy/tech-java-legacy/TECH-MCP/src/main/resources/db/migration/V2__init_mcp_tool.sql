-- V2: MCP Tool (P2-MCP-03)
-- Phase 2 Sprint 1：Tool 注册中心 CRUD + Schema 校验

CREATE TABLE mcp_tool (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    server_id       UUID,
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    input_schema    TEXT,
    output_schema   TEXT,
    tool_type       VARCHAR(20) NOT NULL DEFAULT 'HTTP',
    endpoint        VARCHAR(2048),
    bean_class      VARCHAR(512),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_mcp_tool_tenant_enabled ON mcp_tool (tenant_id, enabled);
CREATE INDEX idx_mcp_tool_server ON mcp_tool (server_id);
CREATE INDEX idx_mcp_tool_code ON mcp_tool (tenant_id, code);
