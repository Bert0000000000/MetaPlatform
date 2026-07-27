-- V6: V12-05 Cypher 查询模板表（REQ-063）
-- 支持保存/分类/复用 Cypher 查询模板

CREATE TABLE IF NOT EXISTS ont_cypher_templates (
    template_id  VARCHAR(64) PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL,
    name         VARCHAR(256) NOT NULL,
    category     VARCHAR(64) NOT NULL,
    description  TEXT,
    query        TEXT NOT NULL,
    tags         JSONB,
    is_builtin   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by   VARCHAR(64),
    updated_by   VARCHAR(64),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_cypher_templates_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ont_cypher_templates_tenant ON ont_cypher_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ont_cypher_templates_category ON ont_cypher_templates(tenant_id, category);
