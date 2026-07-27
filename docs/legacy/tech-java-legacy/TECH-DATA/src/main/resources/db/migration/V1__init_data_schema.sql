-- TECH-DATA 数据库初始化 Schema
-- 对应 Python app/models/orm.py 与 app/deliverables 下的 2 张持久化表

-- 1. data_source — 数据源主表（S-DATA-02）
CREATE TABLE IF NOT EXISTS data_source (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    name              VARCHAR(128) NOT NULL,
    source_type       VARCHAR(32) NOT NULL,
    connection_config JSONB NOT NULL,
    status            VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_data_source_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_data_source_tenant ON data_source(tenant_id);

-- 2. deliverable — 交付物表（P3-DASH-08, 09）
CREATE TABLE IF NOT EXISTS deliverable (
    id            VARCHAR(64) PRIMARY KEY,
    tenant_id     VARCHAR(64) NOT NULL,
    type          VARCHAR(32) NOT NULL,
    title         VARCHAR(256) NOT NULL,
    source        VARCHAR(128) NOT NULL,
    description   VARCHAR(1024),
    format        VARCHAR(16) NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'ready',
    size          INTEGER NOT NULL DEFAULT 0,
    created_by    VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    download_url  VARCHAR(512)
);
CREATE INDEX IF NOT EXISTS idx_deliverable_tenant ON deliverable(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_created ON deliverable(created_at);
