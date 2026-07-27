-- V11: P3-EA-05 技术架构管理

CREATE TABLE ea_tech_stack (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name             VARCHAR(256) NOT NULL,
    code             VARCHAR(128) NOT NULL,
    category         VARCHAR(64),
    vendor           VARCHAR(64),
    description      TEXT,
    version          VARCHAR(64),
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    metadata         JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE TABLE ea_infrastructure (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    environment VARCHAR(64),
    region      VARCHAR(64),
    description TEXT,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_ts_tenant ON ea_tech_stack (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_inf_tenant ON ea_infrastructure (tenant_id) WHERE deleted_at IS NULL;