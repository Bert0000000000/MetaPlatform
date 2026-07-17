CREATE TABLE mcp_client_connection (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    server_url      VARCHAR(2048) NOT NULL,
    transport_type  VARCHAR(20) NOT NULL DEFAULT 'HTTP',
    status          VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    last_connected_at TIMESTAMPTZ,
    config          JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_mcp_client_tenant_status ON mcp_client_connection (tenant_id, status) WHERE deleted_at IS NULL;
