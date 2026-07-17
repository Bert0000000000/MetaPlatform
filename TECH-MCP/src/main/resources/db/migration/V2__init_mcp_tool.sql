CREATE TABLE mcp_tool (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    server_id       UUID,
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    input_schema    JSONB DEFAULT '{}'::jsonb,
    output_schema   JSONB DEFAULT '{}'::jsonb,
    tool_type       VARCHAR(20) NOT NULL DEFAULT 'HTTP',
    endpoint        VARCHAR(2048),
    bean_class      VARCHAR(512),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_mcp_tool_tenant_enabled ON mcp_tool (tenant_id, enabled) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_tool_server ON mcp_tool (server_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_tool_code ON mcp_tool (tenant_id, code) WHERE deleted_at IS NULL;
