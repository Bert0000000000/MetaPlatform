-- V14: V13-09 APP-ARCH 技术架构深度（技术组件库 / 技术栈画像 / 部署拓扑 / 技术雷达）

CREATE TABLE ea_technology_component (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    type        VARCHAR(64) NOT NULL,
    version     VARCHAR(64),
    description TEXT,
    owner       VARCHAR(128),
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, name, type)
);

CREATE TABLE ea_technology_stack (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    application_id VARCHAR(64),
    name           VARCHAR(256) NOT NULL,
    description    TEXT,
    component_refs JSONB DEFAULT '[]'::jsonb,
    status         VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE TABLE ea_deployment_topology (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name          VARCHAR(256) NOT NULL,
    environment   VARCHAR(64) NOT NULL,
    nodes         JSONB DEFAULT '[]'::jsonb,
    edges         JSONB DEFAULT '[]'::jsonb,
    health_status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE TABLE ea_technology_radar (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    quadrants   JSONB DEFAULT '["语言与框架","数据与存储","平台与基础设施","工具与流程"]'::jsonb,
    rings       JSONB DEFAULT '["采纳","试用","评估","暂缓"]'::jsonb,
    items       JSONB DEFAULT '[]'::jsonb,
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_ea_tech_component_tenant ON ea_technology_component (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_tech_stack_tenant ON ea_technology_stack (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_deployment_topology_tenant ON ea_deployment_topology (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_technology_radar_tenant ON ea_technology_radar (tenant_id) WHERE deleted_at IS NULL;
