-- ═══════════════════════════════════════════════════════════
-- TECH-GW API Gateway - Gray release schema (P1-GW-07)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE gw_gray_release (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64),
    api_id UUID,
    name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL,
    strategy VARCHAR(32) NOT NULL,
    strategy_config JSONB DEFAULT '{}'::jsonb,
    new_version VARCHAR(32),
    old_version VARCHAR(32),
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_gw_gray_tenant_status ON gw_gray_release (tenant_id, status);
CREATE INDEX idx_gw_gray_api ON gw_gray_release (api_id);
CREATE INDEX idx_gw_gray_strategy ON gw_gray_release (strategy);
CREATE INDEX idx_gw_gray_tenant_deleted ON gw_gray_release (tenant_id, deleted_at);
