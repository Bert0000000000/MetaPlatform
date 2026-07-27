-- V9: Phase 3 rule statistics + schema alignment
-- 1) Aggregated rule execution statistics (P1-RULE-11)
-- 2) Optional alignment columns for decision tables / test cases

CREATE TABLE IF NOT EXISTS rule_execution_stat (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    target_type       VARCHAR(32) NOT NULL,
    target_id         VARCHAR(64) NOT NULL,
    execution_date    DATE NOT NULL,
    total_count       INTEGER NOT NULL DEFAULT 0,
    hit_count         INTEGER NOT NULL DEFAULT 0,
    miss_count        INTEGER NOT NULL DEFAULT 0,
    error_count       INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms   BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_rule_exec_stat_target_date UNIQUE (tenant_id, target_type, target_id, execution_date)
);

CREATE INDEX IF NOT EXISTS idx_rule_exec_stat_tenant ON rule_execution_stat(tenant_id, execution_date);
CREATE INDEX IF NOT EXISTS idx_rule_exec_stat_target ON rule_execution_stat(tenant_id, target_type, target_id);

-- Align decision table with P1-RULE-07 spec (ruleset linkage)
ALTER TABLE rule_decision_table ADD COLUMN IF NOT EXISTS ruleset_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_rule_decision_table_ruleset ON rule_decision_table(ruleset_id);

-- Align test case with P1-RULE-10 spec (target abstraction)
ALTER TABLE rule_test_case ADD COLUMN IF NOT EXISTS target_type VARCHAR(16);
ALTER TABLE rule_test_case ADD COLUMN IF NOT EXISTS target_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_rule_test_case_target ON rule_test_case(tenant_id, target_type, target_id);
