-- V19: MCP Tool 发布状态（P1 补齐）
-- 新增 status / published_at / published_by 字段，支持 DRAFT -> PUBLISHED -> DEPRECATED 生命周期

ALTER TABLE mcp_tool
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN published_at TIMESTAMP,
    ADD COLUMN published_by VARCHAR(128);

CREATE INDEX idx_mcp_tool_status ON mcp_tool (tenant_id, status);
