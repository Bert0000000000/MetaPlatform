-- ════════════════════════════════════════════════════════════
-- TECH-WFE V3: Outbox 消息表（Kafka 可靠事件发布）
-- 事件类型：TASK_CREATED / TASK_COMPLETED / TASK_REJECTED / TASK_TRANSFERRED
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_outbox_messages (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    aggregate_type  VARCHAR(64)   NOT NULL DEFAULT 'Task',
    aggregate_id    VARCHAR(64)   NOT NULL,
    event_type      VARCHAR(128)  NOT NULL,
    payload         TEXT,
    headers         TEXT,
    status          VARCHAR(16)   NOT NULL DEFAULT 'PENDING',
    retry_count     INT           NOT NULL DEFAULT 0,
    max_retries     INT           NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wfe_outbox_status_created ON wfe_outbox_messages (status, created_at);
CREATE INDEX IF NOT EXISTS idx_wfe_outbox_aggregate ON wfe_outbox_messages (aggregate_type, aggregate_id);
