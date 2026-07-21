-- V10__init_obs_anomaly_schema.sql
-- V15-07: 智能运维与异常自愈
-- 异常检测规则 + 异常事件，支持根因分析与自动修复

CREATE TABLE IF NOT EXISTS obs_anomaly_detection_rule (
    id                      UUID            PRIMARY KEY,
    tenant_id               VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    name                    VARCHAR(256)    NOT NULL,
    metric_type             VARCHAR(64)     NOT NULL,
    condition_operator      VARCHAR(16)     NOT NULL,
    threshold               DOUBLE PRECISION NOT NULL,
    time_window_seconds     INT             NOT NULL DEFAULT 300,
    aggregation_function    VARCHAR(32)     NOT NULL DEFAULT 'AVG',
    severity                VARCHAR(32)     NOT NULL DEFAULT 'WARNING',
    enabled                 BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_anomaly_rule_tenant_enabled
    ON obs_anomaly_detection_rule (tenant_id, enabled);

CREATE INDEX IF NOT EXISTS idx_obs_anomaly_rule_deleted_at
    ON obs_anomaly_detection_rule (deleted_at);

CREATE TABLE IF NOT EXISTS obs_anomaly_event (
    id                  UUID            PRIMARY KEY,
    tenant_id           VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    rule_id             UUID            NOT NULL,
    anomaly_type        VARCHAR(64)     NOT NULL,
    severity            VARCHAR(32)     NOT NULL,
    service_name        VARCHAR(128)    NOT NULL,
    trace_id            VARCHAR(64),
    metric_value        DOUBLE PRECISION NOT NULL DEFAULT 0,
    root_cause          TEXT,
    remediation_action  VARCHAR(128),
    status              VARCHAR(32)     NOT NULL DEFAULT 'OPEN',
    detected_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_anomaly_event_tenant_status
    ON obs_anomaly_event (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_obs_anomaly_event_trace_id
    ON obs_anomaly_event (trace_id);

CREATE INDEX IF NOT EXISTS idx_obs_anomaly_event_detected_at
    ON obs_anomaly_event (detected_at DESC);
