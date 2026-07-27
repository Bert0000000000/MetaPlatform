-- TECH-MCP V17 迁移：IAM RBAC 表
-- v1.3 Phase 1：MCP 平台独立的 RBAC（与 IAM 主服务对齐）

-- ============================================================
-- 1. mcp_role — MCP 角色
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_role (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    code            VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     VARCHAR(512),
    permissions     JSONB DEFAULT '[]'::jsonb,
    builtin         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_role UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_mcp_role_tenant ON mcp_role(tenant_id);

-- ============================================================
-- 2. mcp_role_binding — 角色绑定
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_role_binding (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    role_id         VARCHAR(64) NOT NULL,
    subject_type    VARCHAR(16) NOT NULL,  -- USER / API_KEY / SERVICE
    subject_id      VARCHAR(64) NOT NULL,
    resource_scope  VARCHAR(32) NOT NULL DEFAULT 'TENANT',  -- TENANT / SERVER / TOOL
    resource_id     VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_mcp_subject_type CHECK (subject_type IN ('USER', 'API_KEY', 'SERVICE')),
    CONSTRAINT chk_mcp_resource_scope CHECK (resource_scope IN ('TENANT', 'SERVER', 'TOOL'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_role_binding_subject ON mcp_role_binding(tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_mcp_role_binding_role ON mcp_role_binding(role_id);

-- ============================================================
-- 3. 内置角色初始化
-- ============================================================
-- 在应用启动时通过 RoleInitializer 初始化（避免在 SQL 中硬编码 tenant_id）