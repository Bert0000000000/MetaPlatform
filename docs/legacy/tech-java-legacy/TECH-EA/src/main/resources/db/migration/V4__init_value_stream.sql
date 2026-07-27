-- V4: P3-EA-01 价值流管理

CREATE TABLE ea_value_stream (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    description TEXT,
    stages      JSONB DEFAULT '[]'::jsonb,
    status      VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_vs_tenant ON ea_value_stream (tenant_id) WHERE deleted_at IS NULL;
