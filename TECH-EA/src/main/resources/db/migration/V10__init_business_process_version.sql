-- V10: P3-EA-02 业务流程版本与流程图

CREATE TABLE ea_business_process_version (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    process_id    UUID NOT NULL REFERENCES ea_business_process(id) ON DELETE CASCADE,
    version       INTEGER NOT NULL,
    process_steps JSONB DEFAULT '[]'::jsonb,
    flowchart     JSONB DEFAULT '{}'::jsonb,
    change_note   TEXT,
    created_by    VARCHAR(128),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (process_id, version)
);

CREATE INDEX idx_ea_bpv_process ON ea_business_process_version (process_id);