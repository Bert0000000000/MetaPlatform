-- V1__init_obs_logs_schema.sql
-- TECH-OBS P0: 日志接入基础表
-- 提供 POST /api/v1/obs/logs/ingest 的本地持久化能力
-- 多租户通过 tenant_id 隔离，索引聚焦 (tenant_id, service_name, created_at) 典型查询路径

CREATE TABLE IF NOT EXISTS obs_logs (
    id            VARCHAR(64)    PRIMARY KEY,
    tenant_id     VARCHAR(64)    NOT NULL,
    service_name  VARCHAR(128)   NOT NULL,
    level         VARCHAR(32)    NOT NULL,
    trace_id      VARCHAR(64),
    message       TEXT,
    labels        JSONB,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_logs_tenant_service_created
    ON obs_logs (tenant_id, service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_logs_trace_id
    ON obs_logs (trace_id);

CREATE INDEX IF NOT EXISTS idx_obs_logs_level
    ON obs_logs (level);