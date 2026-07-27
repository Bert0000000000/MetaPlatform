CREATE TABLE action_trigger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    trigger_id      VARCHAR(64) NOT NULL,
    action_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    trigger_type    VARCHAR(20) NOT NULL,
    event_topic     VARCHAR(256),
    cron_expression VARCHAR(128),
    config          JSONB DEFAULT '{}'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(64) NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, trigger_id)
);

CREATE INDEX idx_trigger_tenant_type ON action_trigger (tenant_id, trigger_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_trigger_action ON action_trigger (tenant_id, action_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trigger_enabled_cron ON action_trigger (enabled, cron_expression) WHERE deleted_at IS NULL;
