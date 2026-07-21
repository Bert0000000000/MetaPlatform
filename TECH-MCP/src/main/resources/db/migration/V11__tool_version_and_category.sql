-- V11: MCP Tool Version History + Categories (V13-03)

ALTER TABLE mcp_tool
    ADD COLUMN category VARCHAR(128),
    ADD COLUMN version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    ADD COLUMN tags TEXT;

CREATE INDEX idx_mcp_tool_category ON mcp_tool (tenant_id, category);

CREATE TABLE mcp_tool_version (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    tool_id         UUID NOT NULL,
    version         VARCHAR(32) NOT NULL,
    schema          TEXT,
    description     TEXT,
    change_log      TEXT,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(128),
    FOREIGN KEY (tool_id) REFERENCES mcp_tool(id)
);

CREATE INDEX idx_mcp_tool_version_tool ON mcp_tool_version (tool_id);
CREATE INDEX idx_mcp_tool_version_current ON mcp_tool_version (tool_id, is_current);

CREATE TABLE mcp_tool_category (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    parent_id       UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP,
    UNIQUE (tenant_id, code),
    FOREIGN KEY (parent_id) REFERENCES mcp_tool_category(id)
);

CREATE INDEX idx_mcp_tool_category_parent ON mcp_tool_category (tenant_id, parent_id);
