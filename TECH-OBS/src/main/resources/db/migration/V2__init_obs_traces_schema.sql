-- V2__init_obs_traces_schema.sql
-- TECH-OBS P1-OBS-05: Trace Span 存储 + 服务依赖拓扑
-- 提供 /api/v1/obs/traces 与 /api/v1/obs/topology 所需的持久化能力

CREATE TABLE IF NOT EXISTS obs_trace (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    trace_id        VARCHAR(64)     NOT NULL,
    span_id         VARCHAR(64)     NOT NULL,
    parent_span_id  VARCHAR(64),
    service_name    VARCHAR(128)    NOT NULL,
    operation_name  VARCHAR(256)    NOT NULL,
    start_time_us   BIGINT          NOT NULL,
    duration_us     BIGINT          NOT NULL,
    tags            JSONB           NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(32)     NOT NULL DEFAULT 'OK',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_trace_trace_id
    ON obs_trace (trace_id);

CREATE INDEX IF NOT EXISTS idx_obs_trace_tenant_service_created
    ON obs_trace (tenant_id, service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_trace_start_time
    ON obs_trace (start_time_us DESC);

CREATE TABLE IF NOT EXISTS obs_service_dependency (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           VARCHAR(64)  NOT NULL DEFAULT 'tenant-default',
    source_service      VARCHAR(128) NOT NULL,
    target_service      VARCHAR(128) NOT NULL,
    call_count          BIGINT       NOT NULL DEFAULT 0,
    avg_duration_ms     DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, source_service, target_service)
);

CREATE INDEX IF NOT EXISTS idx_obs_service_dependency_source
    ON obs_service_dependency (source_service);

CREATE INDEX IF NOT EXISTS idx_obs_service_dependency_target
    ON obs_service_dependency (target_service);