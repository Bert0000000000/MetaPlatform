-- ═══════════════════════════════════════════════════════════
-- TECH-GW API Gateway - API catalog schema (P1-GW-03/04)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE gw_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name VARCHAR(256) NOT NULL,
    path VARCHAR(512) NOT NULL,
    method VARCHAR(16) NOT NULL,
    group_name VARCHAR(128) NOT NULL DEFAULT 'default',
    version VARCHAR(32) NOT NULL DEFAULT 'v1',
    target_service VARCHAR(128),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    metadata JSONB DEFAULT '{}'::jsonb,
    request_schema JSONB DEFAULT '{}'::jsonb,
    response_schema JSONB DEFAULT '{}'::jsonb,
    parameters JSONB DEFAULT '{}'::jsonb,
    examples JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uk_gw_api_tenant_path_method_version UNIQUE (tenant_id, path, method, version)
);

CREATE INDEX idx_gw_api_tenant_group ON gw_api (tenant_id, group_name);
CREATE INDEX idx_gw_api_tenant_version ON gw_api (tenant_id, version);
CREATE INDEX idx_gw_api_status ON gw_api (status);
CREATE INDEX idx_gw_api_tenant_deleted ON gw_api (tenant_id, deleted_at);
CREATE INDEX idx_gw_api_path_method ON gw_api (path, method);
