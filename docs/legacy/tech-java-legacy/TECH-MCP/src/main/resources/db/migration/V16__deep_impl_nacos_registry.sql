-- TECH-MCP V16 迁移：Nacos MCP Registry 同步状态
-- v1.3 Phase 1：记录每个 MCP Server/Tool 在 Nacos 3.0+ Registry 中的同步状态

-- ============================================================
-- 1. mcp_nacos_sync_state — Nacos 同步状态
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_nacos_sync_state (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    entity_type     VARCHAR(32) NOT NULL,  -- SERVER / TOOL / RESOURCE / PROMPT
    entity_id       VARCHAR(64) NOT NULL,
    nacos_group     VARCHAR(64) NOT NULL,
    nacos_data_id   VARCHAR(128) NOT NULL,
    sync_status     VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_nacos_sync UNIQUE (tenant_id, entity_type, entity_id),
    CONSTRAINT chk_mcp_nacos_sync_status CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED', 'REMOVED'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_nacos_sync_status ON mcp_nacos_sync_state(sync_status);
CREATE INDEX IF NOT EXISTS idx_mcp_nacos_sync_group ON mcp_nacos_sync_state(nacos_group, nacos_data_id);

-- ============================================================
-- 2. mcp_tool_nacos_meta — Tool Nacos 元数据（便于查询）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_tool_nacos_meta (
    id              VARCHAR(64) PRIMARY KEY,
    tool_id         VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    tool_name       VARCHAR(128) NOT NULL,
    tool_version    VARCHAR(32) NOT NULL,
    server_id       VARCHAR(64),
    server_type     VARCHAR(32),  -- INTERNAL / EXTERNAL
    capabilities    JSONB DEFAULT '[]'::jsonb,
    nacos_endpoint  VARCHAR(512),
    published_at    TIMESTAMPTZ,
    CONSTRAINT uq_mcp_tool_nacos UNIQUE (tool_id, tool_version),
    CONSTRAINT chk_mcp_tool_server_type CHECK (server_type IN ('INTERNAL', 'EXTERNAL'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_nacos_tenant ON mcp_tool_nacos_meta(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_nacos_server ON mcp_tool_nacos_meta(server_id);

-- ============================================================
-- 3. mcp_client_nacos_sync — Client 连接 Nacos 服务发现状态
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_client_nacos_sync (
    id              VARCHAR(64) PRIMARY KEY,
    client_id       VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    server_url      VARCHAR(512) NOT NULL,
    discovered_tools JSONB DEFAULT '[]'::jsonb,
    last_discovery_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    discovery_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    CONSTRAINT uq_mcp_client_nacos UNIQUE (client_id)
);