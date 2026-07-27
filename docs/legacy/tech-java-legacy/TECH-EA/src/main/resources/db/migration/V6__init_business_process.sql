-- V6: P3-EA-02 业务流程管理

CREATE TABLE ea_business_process (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    value_stream_id UUID REFERENCES ea_value_stream(id) ON DELETE SET NULL,
    capabilities    JSONB DEFAULT '[]'::jsonb,
    process_steps   JSONB DEFAULT '[]'::jsonb,
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_bp_tenant ON ea_business_process (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_bp_vs ON ea_business_process (value_stream_id);
