CREATE TABLE IF NOT EXISTS msg_consumer_group (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL DEFAULT 'tenant-default',
    group_id        VARCHAR(249)   NOT NULL,
    topic_name      VARCHAR(249)   NOT NULL,
    member_count    INTEGER        NOT NULL DEFAULT 0,
    consumed_offset BIGINT         NOT NULL DEFAULT 0,
    lag             BIGINT         NOT NULL DEFAULT 0,
    status          VARCHAR(16)    NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, group_id, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_cg_tenant ON msg_consumer_group (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cg_group_id ON msg_consumer_group (group_id);
CREATE INDEX IF NOT EXISTS idx_cg_status ON msg_consumer_group (status);
