-- V19: P0-2A 能力地图容器层 + P0-2B 架构健康度仪表盘
-- 1) ea_capability_maps：能力地图顶层容器（REQ-3.1.2），关联根能力形成完整能力树
-- 2) ea_capability_map_versions：能力地图版本快照（JSON），支持发布与回滚
-- 3) ea_health_scores：架构健康度日度量（按维度），由 @Scheduled 每日计算写入

-- 1. 能力地图（顶层容器）
CREATE TABLE IF NOT EXISTS ea_capability_map (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    map_id              VARCHAR(64) NOT NULL,
    name                VARCHAR(128) NOT NULL,
    code                VARCHAR(64) NOT NULL,
    description         TEXT,
    business_domain     VARCHAR(64),
    root_capability_id  UUID,
    current_version     VARCHAR(32) DEFAULT 'v1.0',
    status              VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (tenant_id, map_id),
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ea_capmap_tenant_domain
    ON ea_capability_map (tenant_id, business_domain) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ea_capmap_root
    ON ea_capability_map (root_capability_id) WHERE deleted_at IS NULL;

-- 2. 能力地图版本快照
CREATE TABLE IF NOT EXISTS ea_capability_map_version (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    map_id      VARCHAR(64) NOT NULL,
    version     VARCHAR(32) NOT NULL,
    snapshot    TEXT NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_by  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, map_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ea_capmapver_map
    ON ea_capability_map_version (tenant_id, map_id);

-- 3. 架构健康度评分（日维度，按 dimension 存储）
CREATE TABLE IF NOT EXISTS ea_health_score (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    score_date  DATE NOT NULL,
    dimension   VARCHAR(32) NOT NULL,
    score       NUMERIC(5,2),
    metrics     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, score_date, dimension)
);

CREATE INDEX IF NOT EXISTS idx_ea_health_date
    ON ea_health_score (tenant_id, score_date DESC);
