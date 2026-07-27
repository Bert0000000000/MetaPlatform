CREATE TABLE IF NOT EXISTS outbox_messages (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL DEFAULT 'tenant-default',
    aggregate_type  VARCHAR(100)   NOT NULL,
    aggregate_id    VARCHAR(255)   NOT NULL,
    event_type      VARCHAR(100)   NOT NULL,
    payload         JSONB          NOT NULL,
    headers         JSONB          NOT NULL DEFAULT '{}',
    status          VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER        NOT NULL DEFAULT 0,
    max_retries     INTEGER        NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_next_retry ON outbox_messages (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_created ON outbox_messages (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_messages (aggregate_type, aggregate_id);
