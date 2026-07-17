CREATE TABLE ea_business_role (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    responsibility  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_role_tenant ON ea_business_role (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_role_code ON ea_business_role (tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE ea_capability_role (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    capability_id   UUID NOT NULL REFERENCES ea_business_capability(id),
    role_id         UUID NOT NULL REFERENCES ea_business_role(id),
    relationship    VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, capability_id, role_id)
);

CREATE INDEX idx_ea_cap_role_cap ON ea_capability_role (capability_id);
CREATE INDEX idx_ea_cap_role_role ON ea_capability_role (role_id);
