-- V18: 应用-能力关联 + 应用-技术组件关联表
-- 1) 为 ea_application 增加 capability_ids JSONB 字段，用于 ImpactAnalysisService 反查能力受影响应用
-- 2) 新建 application_tech_component 关联表，替代 ApplicationEntity.techStack JSON 字符串存储，支持精确图遍历与反向查询

-- 1. 应用-能力关联（JSONB 数组，存储 capability UUID 字符串）
ALTER TABLE ea_application
    ADD COLUMN IF NOT EXISTS capability_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ea_app_caps ON ea_application USING GIN (capability_ids);

-- 2. 应用-技术组件关联表（替代 ApplicationEntity.tech_stack JSON 字符串）
CREATE TABLE IF NOT EXISTS ea_application_tech_component (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    application_id    UUID NOT NULL,
    tech_component_id UUID NOT NULL,
    relationship_type VARCHAR(32) NOT NULL DEFAULT 'USES',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    UNIQUE (tenant_id, application_id, tech_component_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_ea_atc_tenant_app
    ON ea_application_tech_component (tenant_id, application_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ea_atc_tenant_comp
    ON ea_application_tech_component (tenant_id, tech_component_id) WHERE deleted_at IS NULL;
