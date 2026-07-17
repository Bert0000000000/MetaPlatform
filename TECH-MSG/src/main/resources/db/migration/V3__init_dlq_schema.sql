CREATE TABLE IF NOT EXISTS msg_dlq_messages (
    id                    VARCHAR(64)    PRIMARY KEY,
    tenant_id             VARCHAR(64)    NOT NULL DEFAULT 'tenant-default',
    original_topic        VARCHAR(256)   NOT NULL,
    original_message_key  VARCHAR(256),
    payload               TEXT           NOT NULL,
    headers               TEXT,
    error_message         TEXT,
    error_class           VARCHAR(256),
    retry_count           INTEGER        NOT NULL DEFAULT 0,
    status                VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    next_retry_at         TIMESTAMP,
    first_failed_at       TIMESTAMP,
    last_failed_at        TIMESTAMP,
    created_at            TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dlq_tenant_topic ON msg_dlq_messages (tenant_id, original_topic);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON msg_dlq_messages (status);
CREATE INDEX IF NOT EXISTS idx_dlq_tenant_status ON msg_dlq_messages (tenant_id, status);
