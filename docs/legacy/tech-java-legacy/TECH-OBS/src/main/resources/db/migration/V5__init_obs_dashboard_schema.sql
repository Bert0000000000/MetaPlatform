-- V5__init_obs_dashboard_schema.sql
-- TECH-OBS P1-OBS-08: 自定义仪表盘 (CRUD + 分享 + 导出)
-- panels/layout 使用 JSONB 保持灵活布局

CREATE TABLE IF NOT EXISTS obs_dashboard (
    id          UUID            PRIMARY KEY,
    tenant_id   VARCHAR(64)     NOT NULL DEFAULT 'tenant-default',
    title       VARCHAR(256)    NOT NULL,
    description TEXT,
    layout      JSONB           NOT NULL DEFAULT '[]'::jsonb,
    panels      JSONB           NOT NULL DEFAULT '[]'::jsonb,
    is_public   BOOLEAN         NOT NULL DEFAULT FALSE,
    share_token VARCHAR(64),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obs_dashboard_tenant
    ON obs_dashboard (tenant_id);

CREATE INDEX IF NOT EXISTS idx_obs_dashboard_share_token
    ON obs_dashboard (share_token);

CREATE INDEX IF NOT EXISTS idx_obs_dashboard_deleted_at
    ON obs_dashboard (deleted_at);