-- V7: P1-RULE-10 测试用例管理

CREATE TABLE IF NOT EXISTS rule_test_case (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    rule_id         VARCHAR(64),
    ruleset_id      VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    input           JSONB NOT NULL DEFAULT '{}'::jsonb,
    expected_output JSONB,
    actual_output   JSONB,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_test_case_tenant ON rule_test_case(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rule_test_case_ruleset ON rule_test_case(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_rule_test_case_rule ON rule_test_case(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_test_case_status ON rule_test_case(tenant_id, status);
