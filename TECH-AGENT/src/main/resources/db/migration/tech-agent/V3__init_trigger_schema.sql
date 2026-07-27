-- =============================================================================
-- TECH-AGENT V2: Trigger 数据模型（P7.1）
-- -----------------------------------------------------------------------------
-- Trigger 把 Ontology Event → Agent Run 串联起来。
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_trigger (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    trigger_code    VARCHAR(128)   NOT NULL,
    event_topic     VARCHAR(128)   NOT NULL,
    event_filter    TEXT,                                  -- JSON: {concept:..., objectId:...}
    agent_id        VARCHAR(64)    NOT NULL,
    input_template  TEXT,                                  -- 渲染时把 event payload 注入 prompt
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    budget_tokens   INT            NOT NULL DEFAULT 4000,
    cooldown_sec    INT            NOT NULL DEFAULT 0,
    last_fire_at    TIMESTAMP,
    fire_count      INT            NOT NULL DEFAULT 0,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_trigger UNIQUE (tenant_id, trigger_code)
);

CREATE INDEX IF NOT EXISTS idx_trigger_event ON agent_trigger(enabled, event_topic);
