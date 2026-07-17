CREATE TABLE action_outbox_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    aggregate_id    VARCHAR(64) NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message   TEXT,
    trace_id        VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status_retry ON action_outbox_messages (status, next_retry_at);
CREATE INDEX idx_outbox_aggregate ON action_outbox_messages (aggregate_id);
CREATE INDEX idx_outbox_trace ON action_outbox_messages (trace_id);
