-- V12: P3-EA-06 架构评审

CREATE TABLE ea_architecture_review (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    title         VARCHAR(256) NOT NULL,
    review_type   VARCHAR(64) NOT NULL,
    target_id     UUID,
    target_type   VARCHAR(64),
    status        VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    summary       TEXT,
    decision      TEXT,
    comments      JSONB DEFAULT '[]'::jsonb,
    attachments   JSONB DEFAULT '[]'::jsonb,
    created_by    VARCHAR(128),
    reviewer      VARCHAR(128),
    submitted_at  TIMESTAMPTZ,
    decided_at    TIMESTAMPTZ,
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_ea_ar_tenant ON ea_architecture_review (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_ar_status ON ea_architecture_review (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_ar_target ON ea_architecture_review (target_id, target_type) WHERE deleted_at IS NULL;

CREATE TABLE ea_tech_debt (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    title         VARCHAR(256) NOT NULL,
    code          VARCHAR(128) NOT NULL,
    category      VARCHAR(64),
    severity      VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status        VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    scope_type    VARCHAR(64),
    scope_id      UUID,
    description   TEXT,
    impact_score  INTEGER DEFAULT 0,
    remediation   TEXT,
    estimated_effort VARCHAR(64),
    owner         VARCHAR(128),
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_td_tenant ON ea_tech_debt (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_td_severity ON ea_tech_debt (tenant_id, severity) WHERE deleted_at IS NULL;

CREATE TABLE ea_tech_standard (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name          VARCHAR(256) NOT NULL,
    code          VARCHAR(128) NOT NULL,
    category      VARCHAR(64),
    version       VARCHAR(64),
    description   TEXT,
    mandatory     BOOLEAN NOT NULL DEFAULT TRUE,
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_ts2_tenant ON ea_tech_standard (tenant_id) WHERE deleted_at IS NULL;