-- V6: P1-RULE-08 决策表规则行管理
-- 每行包含输入值与输出值，支持启用/禁用

CREATE TABLE IF NOT EXISTS rule_decision_table_row (
    id              VARCHAR(64) PRIMARY KEY,
    table_id        VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    row_order       INTEGER NOT NULL DEFAULT 0,
    input_values    JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_values   JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dt_row_table FOREIGN KEY (table_id)
        REFERENCES rule_decision_table(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rule_dt_row_table ON rule_decision_table_row(table_id, row_order);
CREATE INDEX IF NOT EXISTS idx_rule_dt_row_tenant ON rule_decision_table_row(tenant_id);
