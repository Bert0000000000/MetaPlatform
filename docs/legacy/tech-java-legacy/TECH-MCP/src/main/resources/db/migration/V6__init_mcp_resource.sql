-- V6: MCP Resource (P3-MCP-01)
-- Phase 3：Resource 管理（文档/架构资产资源 + 内容读取）

CREATE TABLE mcp_resource (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    uri             VARCHAR(512) NOT NULL,
    description     TEXT,
    mime_type       VARCHAR(128),
    content         TEXT,
    metadata        TEXT,
    related_concept_id VARCHAR(128),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,
    UNIQUE (tenant_id, uri)
);

CREATE INDEX idx_mcp_resource_tenant ON mcp_resource (tenant_id);
CREATE INDEX idx_mcp_resource_concept ON mcp_resource (tenant_id, related_concept_id);
