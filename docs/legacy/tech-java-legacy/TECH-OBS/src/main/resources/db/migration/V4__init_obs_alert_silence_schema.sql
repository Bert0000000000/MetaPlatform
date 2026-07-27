-- V4__init_obs_alert_silence_schema.sql
-- TECH-OBS P1-OBS-07: 告警静默记录表

CREATE TABLE IF NOT EXISTS obs_alert_silence (
    id              UUID            PRIMARY KEY,
    alert_id        UUID            NOT NULL,
    tenant_id       VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    silenced_until  TIMESTAMPTZ     NOT NULL,
    reason          TEXT,
    created_by      VARCHAR(128),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_alert_silence_alert_id
    ON obs_alert_silence (alert_id);

CREATE INDEX IF NOT EXISTS idx_obs_alert_silence_until
    ON obs_alert_silence (silenced_until);