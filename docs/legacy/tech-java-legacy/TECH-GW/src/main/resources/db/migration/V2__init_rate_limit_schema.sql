-- ═══════════════════════════════════════════════════════════
-- TECH-GW API Gateway - Rate limit rule schema
-- ═══════════════════════════════════════════════════════════

CREATE TABLE gw_rate_limit_rule (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    rule_id VARCHAR(64) NOT NULL,
    rule_name VARCHAR(128) NOT NULL,
    description VARCHAR(1024),
    route_id VARCHAR(64),
    scope VARCHAR(16) NOT NULL,
    limit_type VARCHAR(16) NOT NULL,
    qps_limit INTEGER,
    concurrent_limit INTEGER,
    token_limit BIGINT,
    token_window VARCHAR(16),
    burst_factor NUMERIC(3,1) DEFAULT 1.0,
    quota_alert_threshold INTEGER DEFAULT 80,
    status VARCHAR(16) NOT NULL DEFAULT 'ENABLED',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uk_rate_limits_rule_id ON gw_rate_limit_rule (rule_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uk_rate_limits_tenant_name ON gw_rate_limit_rule (tenant_id, rule_name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uk_rate_limits_route_scope_type ON gw_rate_limit_rule (tenant_id, route_id, scope, limit_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_rate_limits_route ON gw_rate_limit_rule (route_id);
CREATE INDEX idx_rate_limits_status ON gw_rate_limit_rule (status);
CREATE INDEX idx_rate_limits_tenant_deleted ON gw_rate_limit_rule (tenant_id, deleted_at);
