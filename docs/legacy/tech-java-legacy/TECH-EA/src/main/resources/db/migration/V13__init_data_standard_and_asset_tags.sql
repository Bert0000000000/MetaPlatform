-- V13: 数据标准管理 + 数据资产标签

CREATE TABLE ea_data_standard (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    code          VARCHAR(128) NOT NULL,
    name          VARCHAR(256) NOT NULL,
    standard_type VARCHAR(64) NOT NULL,
    rule          TEXT,
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

ALTER TABLE ea_data_asset ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_ea_ds_tenant ON ea_data_standard (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_da_tags ON ea_data_asset USING GIN (tags);
