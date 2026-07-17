CREATE TABLE action_orchestration (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          VARCHAR(64) NOT NULL,
    orchestration_id   VARCHAR(64) NOT NULL,
    name               VARCHAR(256) NOT NULL,
    code               VARCHAR(128) NOT NULL,
    description        TEXT,
    nodes              JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges              JSONB NOT NULL DEFAULT '[]'::jsonb,
    status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version            INT NOT NULL DEFAULT 1,
    created_by         VARCHAR(64) NOT NULL,
    updated_by         VARCHAR(64),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ,
    UNIQUE (tenant_id, orchestration_id),
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_orch_tenant_status ON action_orchestration (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orch_code ON action_orchestration (tenant_id, code) WHERE deleted_at IS NULL;
