-- V1: MCP Server (P2-MCP-02)
-- Phase 2 Sprint 1：Server CRUD + 启停 + 能力清单

CREATE TABLE mcp_server (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    transport_type  VARCHAR(20) NOT NULL,
    endpoint_url    VARCHAR(2048),
    status          VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    config          TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_mcp_server_tenant_status ON mcp_server (tenant_id, status);
CREATE INDEX idx_mcp_server_code ON mcp_server (tenant_id, code);
