-- V5: P3-EA-01 价值流-能力关联

CREATE TABLE ea_value_stream_capability (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value_stream_id   UUID NOT NULL REFERENCES ea_value_stream(id) ON DELETE CASCADE,
    capability_id     UUID NOT NULL REFERENCES ea_business_capability(id) ON DELETE CASCADE,
    stage_name        VARCHAR(256),
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (value_stream_id, capability_id, stage_name)
);

CREATE INDEX idx_ea_vsc_vs ON ea_value_stream_capability (value_stream_id);
CREATE INDEX idx_ea_vsc_cap ON ea_value_stream_capability (capability_id);
