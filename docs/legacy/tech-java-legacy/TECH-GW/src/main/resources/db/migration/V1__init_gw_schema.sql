-- ═══════════════════════════════════════════════════════════
-- TECH-GW API Gateway - Route table schema
-- ═══════════════════════════════════════════════════════════

CREATE TABLE gw_route (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    route_id VARCHAR(128) NOT NULL,
    name VARCHAR(128),
    uri VARCHAR(256) NOT NULL,
    predicates TEXT,
    filters TEXT,
    priority INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_gw_route_tenant_route_id UNIQUE (tenant_id, route_id)
);

CREATE INDEX idx_gw_route_enabled ON gw_route (enabled);
CREATE INDEX idx_gw_route_tenant ON gw_route (tenant_id);
