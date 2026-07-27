-- V4: P1-RULE-05 规则集版本管理
-- 规则集变更生成版本快照，支持查询历史版本

CREATE TABLE IF NOT EXISTS rule_ruleset_version (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    ruleset_id      VARCHAR(64) NOT NULL,
    version_number  INTEGER NOT NULL,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    snapshot        JSONB NOT NULL,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_rule_ruleset_version_ruleset FOREIGN KEY (ruleset_id)
        REFERENCES rule_ruleset(id) ON DELETE CASCADE,
    CONSTRAINT uk_rule_ruleset_version_ruleset_version UNIQUE (tenant_id, ruleset_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rule_ruleset_version_ruleset ON rule_ruleset_version(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_rule_ruleset_version_tenant ON rule_ruleset_version(tenant_id, created_at);
