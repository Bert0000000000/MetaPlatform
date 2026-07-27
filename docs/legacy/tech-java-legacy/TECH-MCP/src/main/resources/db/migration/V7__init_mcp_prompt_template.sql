-- V7: MCP Prompt Template (P3-MCP-02)
-- Phase 3：Prompt 模板管理（角色模板 + 变量 + 渲染）

CREATE TABLE mcp_prompt_template (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    template        TEXT NOT NULL,
    variables       TEXT,
    version         INT NOT NULL DEFAULT 1,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    category        VARCHAR(64),
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP,
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_mcp_prompt_tenant ON mcp_prompt_template (tenant_id);
CREATE INDEX idx_mcp_prompt_category ON mcp_prompt_template (tenant_id, category);
CREATE INDEX idx_mcp_prompt_status ON mcp_prompt_template (tenant_id, status);
