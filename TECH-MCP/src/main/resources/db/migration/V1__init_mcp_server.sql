CREATE TABLE mcp_server (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    transport_type  VARCHAR(20) NOT NULL,
    endpoint_url    VARCHAR(2048),
    status          VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    config          JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_mcp_server_tenant_status ON mcp_server (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_server_code ON mcp_server (tenant_id, code) WHERE deleted_at IS NULL;
