CREATE TABLE mcp_resource (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    uri             VARCHAR(512) NOT NULL,
    description     TEXT,
    mime_type       VARCHAR(128),
    content         TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    related_concept_id VARCHAR(128),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, uri)
);

CREATE INDEX idx_mcp_resource_tenant ON mcp_resource (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_resource_concept ON mcp_resource (tenant_id, related_concept_id) WHERE deleted_at IS NULL;