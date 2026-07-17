-- V7: P3-EA-03 应用管理

CREATE TABLE ea_application (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name         VARCHAR(256) NOT NULL,
    code         VARCHAR(128) NOT NULL,
    description  TEXT,
    app_type     VARCHAR(64),
    status       VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    tech_stack   JSONB DEFAULT '[]'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_app_tenant ON ea_application (tenant_id) WHERE deleted_at IS NULL;
