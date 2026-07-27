-- V4: MCP Client Connection (P2-MCP-09)
-- Phase 2 Sprint 2：MCP Client 管理

CREATE TABLE mcp_client_connection (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    server_url      VARCHAR(2048) NOT NULL,
    transport_type  VARCHAR(20) NOT NULL DEFAULT 'HTTP',
    status          VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    last_connected_at TIMESTAMP,
    config          TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_mcp_client_tenant_status ON mcp_client_connection (tenant_id, status);
