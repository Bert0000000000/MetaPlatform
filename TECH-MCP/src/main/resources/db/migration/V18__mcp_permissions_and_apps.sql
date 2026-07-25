-- TECH-MCP V18 迁移：权限规则 + 外部应用子资源（配置 / API Key）
-- P0-1：McpPermissionController 权限规则 CRUD + 矩阵 + 检查
-- P0-6：ExternalAppConfigController 应用配置 / API Key / 工具授权
-- 注意：应用工具授权复用 mcp_permission_rules（subject_type=EXTERNAL_APP），不再单独建表。

-- ============================================================
-- 1. mcp_permission_rules — 权限规则（RBAC + ABAC 混合）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_permission_rules (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    rule_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    subject_type    VARCHAR(16) NOT NULL,  -- USER / ROLE / AGENT / EXTERNAL_APP
    subject_id      VARCHAR(64) NOT NULL,
    resource_type   VARCHAR(16) NOT NULL,  -- TOOL / RESOURCE / PROMPT / SERVER
    resource_id     VARCHAR(64),           -- NULL 表示通配所有资源
    actions         VARCHAR(128) NOT NULL, -- 逗号分隔：execute,read,list
    effect          VARCHAR(8) NOT NULL,   -- ALLOW / DENY
    priority        INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_permission_rule_id UNIQUE (rule_id),
    CONSTRAINT chk_mcp_perm_subject_type CHECK (subject_type IN ('USER', 'ROLE', 'AGENT', 'EXTERNAL_APP')),
    CONSTRAINT chk_mcp_perm_resource_type CHECK (resource_type IN ('TOOL', 'RESOURCE', 'PROMPT', 'SERVER')),
    CONSTRAINT chk_mcp_perm_effect CHECK (effect IN ('ALLOW', 'DENY'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_rule_tenant ON mcp_permission_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_rule_subject ON mcp_permission_rules(tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_rule_resource ON mcp_permission_rules(tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_rule_priority ON mcp_permission_rules(tenant_id, priority DESC);

-- ============================================================
-- 2. mcp_app_configs — 外部应用配置（限流 / 超时 / 工具黑白名单 / webhook）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_app_configs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    app_id          VARCHAR(64) NOT NULL,  -- 对应 mcp_external_agent.id（UUID 字符串）
    rate_limit_qps  INTEGER,
    timeout_ms      INTEGER,
    allowed_tools   TEXT,                  -- JSON array，白名单
    denied_tools    TEXT,                  -- JSON array，黑名单
    webhook_url     VARCHAR(512),
    metadata        TEXT,                  -- JSON
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_app_config_app UNIQUE (tenant_id, app_id)
);
CREATE INDEX IF NOT EXISTS idx_mcp_app_config_tenant ON mcp_app_configs(tenant_id, app_id);

-- ============================================================
-- 3. mcp_app_api_keys — 外部应用 API Key（绑定 external-agent）
--    与 mcp_api_key（V15，平台级 API Key）分离，避免污染主鉴权表。
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_app_api_keys (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    app_id          VARCHAR(64) NOT NULL,  -- 对应 mcp_external_agent.id
    key_id          VARCHAR(64) NOT NULL,
    key_hash        VARCHAR(128) NOT NULL, -- BCrypt hash
    name            VARCHAR(128),
    status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / REVOKED
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_app_api_key_id UNIQUE (key_id),
    CONSTRAINT chk_mcp_app_api_key_status CHECK (status IN ('ACTIVE', 'REVOKED'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_app_api_key_app ON mcp_app_api_keys(tenant_id, app_id);
CREATE INDEX IF NOT EXISTS idx_mcp_app_api_key_status ON mcp_app_api_keys(tenant_id, app_id, status);
