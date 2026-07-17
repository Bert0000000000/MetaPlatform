-- V3: P1-RULE-03 规则执行事件 Outbox 表
-- 规则命中后写入 rule_outbox_messages，后台 Relay 投递到 Kafka
-- Kafka 消息头包含 X-Trace-Id，超过 max_retries 后 status=FAILED

CREATE TABLE IF NOT EXISTS rule_outbox_messages (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    aggregate_type  VARCHAR(64)    NOT NULL,
    aggregate_id    VARCHAR(64)    NOT NULL,
    event_type      VARCHAR(128)   NOT NULL,
    payload         TEXT           NOT NULL,
    headers         TEXT,
    status          VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    retry_count     INT            NOT NULL DEFAULT 0,
    max_retries     INT            NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_outbox_status ON rule_outbox_messages(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_rule_outbox_tenant ON rule_outbox_messages(tenant_id, created_at);
