-- V8: P3-EA-04 数据架构管理

CREATE TABLE ea_data_domain (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    description TEXT,
    owner       VARCHAR(128),
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE TABLE ea_data_entity (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    domain_id     UUID REFERENCES ea_data_domain(id) ON DELETE SET NULL,
    name          VARCHAR(256) NOT NULL,
    code          VARCHAR(128) NOT NULL,
    description   TEXT,
    entity_type   VARCHAR(64),
    attributes    JSONB DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE TABLE ea_data_flow (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name          VARCHAR(256) NOT NULL,
    source_entity_id UUID REFERENCES ea_data_entity(id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES ea_data_entity(id) ON DELETE CASCADE,
    flow_type     VARCHAR(64),
    description   TEXT,
    schedule      VARCHAR(128),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE TABLE ea_data_asset (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name          VARCHAR(256) NOT NULL,
    code          VARCHAR(128) NOT NULL,
    asset_type    VARCHAR(64) NOT NULL,
    description   TEXT,
    entity_id     UUID REFERENCES ea_data_entity(id) ON DELETE SET NULL,
    classification VARCHAR(64),
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_dd_tenant ON ea_data_domain (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_de_tenant ON ea_data_entity (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_de_domain ON ea_data_entity (domain_id);
CREATE INDEX idx_ea_df_tenant ON ea_data_flow (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_da_tenant ON ea_data_asset (tenant_id) WHERE deleted_at IS NULL;
