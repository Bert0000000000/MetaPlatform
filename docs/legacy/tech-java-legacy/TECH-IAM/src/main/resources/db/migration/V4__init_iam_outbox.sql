-- V4: S-IAM-05 Kafka Outbox 基础版
-- 实现 Outbox 模式：业务事务中先将事件写入 iam_outbox_messages 表，
-- 再由后台定时任务（IamOutboxService.relay）轮询 PENDING 消息投递到 Kafka。
-- 约束：
--   - trace_id 必须在所有系统组件间传播，Kafka 消息头包含 X-Trace-Id
--   - DLQ 策略：超过 max_retries 后 status=FAILED，由运维人工介入

CREATE TABLE IF NOT EXISTS iam_outbox_messages (
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

CREATE INDEX IF NOT EXISTS idx_iam_outbox_status ON iam_outbox_messages(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_iam_outbox_tenant ON iam_outbox_messages(tenant_id, created_at);
