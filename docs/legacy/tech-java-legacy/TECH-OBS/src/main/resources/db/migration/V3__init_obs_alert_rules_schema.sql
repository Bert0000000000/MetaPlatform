-- V3__init_obs_alert_rules_schema.sql
-- TECH-OBS P1-OBS-06: 告警规则、通知通道、活动告警
-- 多租户隔离，软删除 (deleted_at) 用于审计

CREATE TABLE IF NOT EXISTS obs_alert_rule (
    id                      UUID            PRIMARY KEY,
    tenant_id               VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    name                    VARCHAR(256)    NOT NULL,
    metric_name             VARCHAR(256)    NOT NULL,
    condition_operator      VARCHAR(16)     NOT NULL,
    threshold               DOUBLE PRECISION NOT NULL,
    duration_seconds        INT             NOT NULL DEFAULT 60,
    severity                VARCHAR(32)     NOT NULL DEFAULT 'WARNING',
    notification_channels   JSONB           NOT NULL DEFAULT '[]'::jsonb,
    enabled                 BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_alert_rule_tenant_enabled
    ON obs_alert_rule (tenant_id, enabled);

CREATE INDEX IF NOT EXISTS idx_obs_alert_rule_deleted_at
    ON obs_alert_rule (deleted_at);

CREATE TABLE IF NOT EXISTS obs_alert_notification_channel (
    id          UUID            PRIMARY KEY,
    tenant_id   VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256)    NOT NULL,
    type        VARCHAR(32)     NOT NULL,
    config      JSONB           NOT NULL DEFAULT '{}'::jsonb,
    enabled     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_alert_channel_tenant
    ON obs_alert_notification_channel (tenant_id);

CREATE INDEX IF NOT EXISTS idx_obs_alert_channel_deleted_at
    ON obs_alert_notification_channel (deleted_at);

CREATE TABLE IF NOT EXISTS obs_alert (
    id              UUID            PRIMARY KEY,
    rule_id         UUID            NOT NULL,
    tenant_id       VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    triggered_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    value           DOUBLE PRECISION NOT NULL DEFAULT 0,
    status          VARCHAR(32)     NOT NULL DEFAULT 'FIRING',
    message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_obs_alert_tenant_status
    ON obs_alert (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_obs_alert_rule_id
    ON obs_alert (rule_id);

CREATE INDEX IF NOT EXISTS idx_obs_alert_triggered_at
    ON obs_alert (triggered_at DESC);