-- V7__init_obs_slo_schema.sql
-- TECH-OBS P1-OBS-10: SLO 服务等级目标
-- 错误预算 + 燃烧率,支持 AVAILABILITY/LATENCY/THROUGHPUT 三种 SLI

CREATE TABLE IF NOT EXISTS obs_slo (
    id                      UUID            PRIMARY KEY,
    tenant_id               VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    name                    VARCHAR(256)    NOT NULL,
    description             TEXT,
    service_name            VARCHAR(128)    NOT NULL,
    sli_type                VARCHAR(32)     NOT NULL,
    sli_query               TEXT            NOT NULL,
    target                  DOUBLE PRECISION NOT NULL,
    "window"                VARCHAR(32)     NOT NULL DEFAULT '30d',
    error_budget_total      DOUBLE PRECISION,
    error_budget_consumed   DOUBLE PRECISION NOT NULL DEFAULT 0,
    burn_rate               DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                  VARCHAR(32)     NOT NULL DEFAULT 'HEALTHY',
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_slo_tenant_service
    ON obs_slo (tenant_id, service_name);

CREATE INDEX IF NOT EXISTS idx_obs_slo_deleted_at
    ON obs_slo (deleted_at);

CREATE INDEX IF NOT EXISTS idx_obs_slo_status
    ON obs_slo (status);