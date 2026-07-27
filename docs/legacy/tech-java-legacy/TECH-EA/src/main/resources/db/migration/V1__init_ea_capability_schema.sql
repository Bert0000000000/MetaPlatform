CREATE TABLE ea_business_capability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    parent_id       UUID REFERENCES ea_business_capability(id),
    level           INT NOT NULL DEFAULT 0,
    sort_order      INT NOT NULL DEFAULT 0,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_cap_tenant_status ON ea_business_capability (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_cap_parent ON ea_business_capability (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_cap_code ON ea_business_capability (tenant_id, code) WHERE deleted_at IS NULL;
