CREATE TABLE mcp_prompt_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    template        TEXT NOT NULL,
    variables       JSONB DEFAULT '[]'::jsonb,
    version         INT NOT NULL DEFAULT 1,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    category        VARCHAR(64),
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_mcp_prompt_tenant ON mcp_prompt_template (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_prompt_category ON mcp_prompt_template (tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_prompt_status ON mcp_prompt_template (tenant_id, status) WHERE deleted_at IS NULL;