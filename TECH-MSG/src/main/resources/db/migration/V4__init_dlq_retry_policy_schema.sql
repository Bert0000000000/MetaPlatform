CREATE TABLE IF NOT EXISTS msg_dlq_retry_policies (
    id                       VARCHAR(64)    PRIMARY KEY,
    tenant_id                VARCHAR(64)    NOT NULL DEFAULT 'tenant-default',
    topic                    VARCHAR(256)   NOT NULL,
    max_retries              INTEGER        NOT NULL DEFAULT 3,
    retry_interval_seconds   INTEGER        NOT NULL DEFAULT 60,
    retry_backoff_multiplier DOUBLE         NOT NULL DEFAULT 2.0,
    auto_cleanup_days        INTEGER        NOT NULL DEFAULT 30,
    created_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_dlq_policy_tenant ON msg_dlq_retry_policies (tenant_id);
