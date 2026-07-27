-- V14: External Agent Directory, Trust Management and Collaboration Audit (V14-09)

CREATE TABLE mcp_external_agent (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    endpoint        VARCHAR(2048) NOT NULL,
    protocol_type   VARCHAR(20) NOT NULL DEFAULT 'MCP',
    status          VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',
    trust_level     VARCHAR(20) NOT NULL DEFAULT 'UNTRUSTED',
    auth_type       VARCHAR(20),
    auth_config     TEXT,
    capabilities    TEXT,
    last_connected_at TIMESTAMP,
    last_error_message TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_mcp_external_agent_tenant_status ON mcp_external_agent (tenant_id, status);
CREATE INDEX idx_mcp_external_agent_tenant_trust ON mcp_external_agent (tenant_id, trust_level);
CREATE INDEX idx_mcp_external_agent_tenant_name ON mcp_external_agent (tenant_id, name);

CREATE TABLE mcp_agent_trust (
    id                  UUID PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    agent_id            UUID NOT NULL,
    trust_level         VARCHAR(20) NOT NULL DEFAULT 'UNTRUSTED',
    reason              TEXT,
    allowed_operations  TEXT,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_agent_trust_agent FOREIGN KEY (agent_id) REFERENCES mcp_external_agent (id)
);

CREATE INDEX idx_mcp_agent_trust_tenant_agent ON mcp_agent_trust (tenant_id, agent_id);
CREATE INDEX idx_mcp_agent_trust_tenant_level ON mcp_agent_trust (tenant_id, trust_level);

CREATE TABLE mcp_collaboration_audit (
    id                  UUID PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    caller_id           VARCHAR(256) NOT NULL,
    caller_type         VARCHAR(20) NOT NULL DEFAULT 'AGENT',
    callee_id           VARCHAR(256) NOT NULL,
    callee_type         VARCHAR(20) NOT NULL DEFAULT 'AGENT',
    operation           VARCHAR(256),
    protocol_type       VARCHAR(20) NOT NULL DEFAULT 'MCP',
    status              VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    duration_ms         BIGINT NOT NULL DEFAULT 0,
    request_payload     TEXT,
    response_payload    TEXT,
    error_message       TEXT,
    trace_id            VARCHAR(64),
    called_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_collaboration_tenant_called ON mcp_collaboration_audit (tenant_id, called_at);
CREATE INDEX idx_mcp_collaboration_trace ON mcp_collaboration_audit (trace_id);
CREATE INDEX idx_mcp_collaboration_status ON mcp_collaboration_audit (tenant_id, status, called_at);
