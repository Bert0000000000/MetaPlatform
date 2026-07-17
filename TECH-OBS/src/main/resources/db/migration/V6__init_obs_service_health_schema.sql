-- V6__init_obs_service_health_schema.sql
-- TECH-OBS P1-OBS-09: 服务健康状态

CREATE TABLE IF NOT EXISTS obs_service_health (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name      VARCHAR(128)    NOT NULL,
    tenant_id         VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    status            VARCHAR(32)     NOT NULL DEFAULT 'UNKNOWN',
    last_check_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    response_time_ms  DOUBLE PRECISION NOT NULL DEFAULT 0,
    error_rate        DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_obs_service_health_status
    ON obs_service_health (status);

CREATE INDEX IF NOT EXISTS idx_obs_service_health_last_check
    ON obs_service_health (last_check_at DESC);