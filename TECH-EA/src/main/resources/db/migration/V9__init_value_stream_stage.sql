-- V9: P3-EA-01 价值流阶段管理

CREATE TABLE ea_value_stream_stage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    value_stream_id UUID NOT NULL REFERENCES ea_value_stream(id) ON DELETE CASCADE,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (value_stream_id, name)
);

CREATE INDEX idx_ea_vss_vs ON ea_value_stream_stage (value_stream_id) WHERE deleted_at IS NULL;