-- V5: P1-RULE-07 决策表管理
-- 决策表支持 hit_policy(FIRST/ALL/PRIORITY)，列定义存储为 JSONB

CREATE TABLE IF NOT EXISTS rule_decision_table (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    hit_policy      VARCHAR(16) NOT NULL DEFAULT 'FIRST',
    input_columns   JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_columns  JSONB NOT NULL DEFAULT '[]'::jsonb,
    status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    version         INTEGER NOT NULL DEFAULT 1,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uk_rule_decision_table_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_rule_decision_table_tenant ON rule_decision_table(tenant_id) WHERE deleted_at IS NULL;
