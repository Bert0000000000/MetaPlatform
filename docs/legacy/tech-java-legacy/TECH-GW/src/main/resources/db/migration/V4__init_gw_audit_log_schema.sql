-- ═══════════════════════════════════════════════════════════
-- TECH-GW API Gateway - Audit log + alert rules (P1-GW-05/06)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE gw_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64),
    api_id UUID,
    path VARCHAR(512),
    method VARCHAR(16),
    status_code INT,
    request_size BIGINT,
    response_size BIGINT,
    duration_ms BIGINT NOT NULL,
    user_id VARCHAR(64),
    trace_id VARCHAR(64),
    client_ip VARCHAR(64),
    error_message TEXT,
    is_error BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gw_audit_tenant_created ON gw_audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_gw_audit_path_method ON gw_audit_log (path, method);
CREATE INDEX idx_gw_audit_user ON gw_audit_log (user_id);
CREATE INDEX idx_gw_audit_trace ON gw_audit_log (trace_id);
CREATE INDEX idx_gw_audit_status ON gw_audit_log (status_code);
CREATE INDEX idx_gw_audit_is_error ON gw_audit_log (is_error);
CREATE INDEX idx_gw_audit_duration ON gw_audit_log (duration_ms);
CREATE INDEX idx_gw_audit_api_id ON gw_audit_log (api_id);

CREATE TABLE gw_audit_alert_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64),
    name VARCHAR(256) NOT NULL,
    condition_type VARCHAR(32) NOT NULL,
    threshold_ms BIGINT,
    threshold_error_rate DOUBLE PRECISION,
    threshold_rps BIGINT,
    enabled BOOLEAN DEFAULT TRUE,
    notification_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_gw_alert_tenant_deleted ON gw_audit_alert_rule (tenant_id, deleted_at);
CREATE INDEX idx_gw_alert_enabled ON gw_audit_alert_rule (enabled);
CREATE INDEX idx_gw_alert_type ON gw_audit_alert_rule (condition_type);
