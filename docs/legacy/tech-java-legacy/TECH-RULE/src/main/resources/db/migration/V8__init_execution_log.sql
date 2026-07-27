-- V8: P1-RULE-11 规则执行监控日志

CREATE TABLE IF NOT EXISTS rule_execution_log (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    rule_id           VARCHAR(64),
    ruleset_id        VARCHAR(64),
    input             JSONB,
    output            JSONB,
    matched           BOOLEAN,
    execution_time_ms BIGINT,
    error_message     TEXT,
    trace_id          VARCHAR(128),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_exec_log_tenant ON rule_execution_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_exec_log_rule ON rule_execution_log(rule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_exec_log_ruleset ON rule_execution_log(ruleset_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_exec_log_trace ON rule_execution_log(trace_id);
