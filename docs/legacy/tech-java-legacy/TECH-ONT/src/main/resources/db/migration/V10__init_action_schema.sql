-- =============================================================================
-- V10: P1.1.4 Ontology Action Schema
-- -----------------------------------------------------------------------------
-- Action 定义：参数 Schema、风险等级、审批策略、目标 Concept 绑定。
-- 与 TECH-ACTION 的执行链路解耦：这里只负责"声明"，执行由 TECH-ACTION 完成。
-- =============================================================================

CREATE TABLE IF NOT EXISTS ont_action (
    id                  VARCHAR(64)    PRIMARY KEY,
    tenant_id           VARCHAR(64)    NOT NULL,
    action_code         VARCHAR(128)   NOT NULL,
    target_concept_code VARCHAR(64)    NOT NULL,
    display_name        VARCHAR(256)   NOT NULL,
    description         TEXT,
    parameter_schema    TEXT           NOT NULL,   -- JSON Schema: 描述入参
    return_schema       TEXT,                       -- JSON Schema: 描述返回
    risk_level          VARCHAR(16)    NOT NULL DEFAULT 'LOW', -- LOW / MEDIUM / HIGH / CRITICAL
    approval_required   BOOLEAN        NOT NULL DEFAULT FALSE,
    idempotency_key     VARCHAR(128),               -- 默认幂等键模板
    side_effect         TEXT,                       -- 副作用描述（人类可读）
    enabled             BOOLEAN        NOT NULL DEFAULT TRUE,
    version             INT            NOT NULL DEFAULT 1,
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_action UNIQUE (tenant_id, action_code)
);

CREATE INDEX IF NOT EXISTS idx_action_concept ON ont_action(tenant_id, target_concept_code, enabled);
CREATE INDEX IF NOT EXISTS idx_action_risk ON ont_action(tenant_id, risk_level);

COMMENT ON TABLE  ont_action IS 'Ontology Action 定义：声明哪些 Action 可以改变业务对象';
COMMENT ON COLUMN ont_action.parameter_schema IS 'JSON Schema 格式的参数定义';
COMMENT ON COLUMN ont_action.risk_level IS 'LOW / MEDIUM / HIGH / CRITICAL；HIGH/CRITICAL 强制走审批';
