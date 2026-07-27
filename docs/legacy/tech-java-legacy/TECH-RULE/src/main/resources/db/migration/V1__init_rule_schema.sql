-- ════════════════════════════════════════════════════════════
-- TECH-RULE V1: 规则集 + 规则定义表结构
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rule_ruleset (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    status      VARCHAR(32) NOT NULL DEFAULT 'ENABLED',
    priority    INTEGER NOT NULL DEFAULT 0,
    version     INTEGER NOT NULL DEFAULT 1,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  VARCHAR(64),
    updated_by  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_rule_ruleset_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_rule_ruleset_tenant ON rule_ruleset(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rule_ruleset_status ON rule_ruleset(status);

CREATE TABLE IF NOT EXISTS rule_definition (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    ruleset_id      VARCHAR(64) NOT NULL,
    code            VARCHAR(128) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    condition_expr  TEXT NOT NULL,
    action_type     VARCHAR(32) NOT NULL,
    action_config   JSONB,
    priority        INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_rule_definition_ruleset FOREIGN KEY (ruleset_id)
        REFERENCES rule_ruleset(id) ON DELETE CASCADE,
    CONSTRAINT uk_rule_definition_tenant_ruleset_code UNIQUE (tenant_id, ruleset_id, code)
);

CREATE INDEX IF NOT EXISTS idx_rule_definition_tenant ON rule_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rule_definition_ruleset ON rule_definition(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_rule_definition_enabled ON rule_definition(enabled);
