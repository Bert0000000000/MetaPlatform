-- V13: MCP Audit Log 多维分析字段 + 告警规则表（V13-05）

ALTER TABLE mcp_audit_log
    ADD COLUMN IF NOT EXISTS server_id UUID,
    ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE INDEX IF NOT EXISTS idx_mcp_audit_server ON mcp_audit_log (tenant_id, server_id, called_at);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_client ON mcp_audit_log (tenant_id, client_id, called_at);

CREATE TABLE IF NOT EXISTS mcp_alert_rule (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(128) NOT NULL,
    metric          VARCHAR(64) NOT NULL,
    threshold       NUMERIC(10,4) NOT NULL,
    window_minutes  INT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    notify_channels TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_alert_rule_tenant ON mcp_alert_rule (tenant_id, enabled);
