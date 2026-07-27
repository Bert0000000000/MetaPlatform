-- V5: P1-ONT-10/11/12 本体版本管理
-- 支持创建快照、列表、详情、对比、发布、回滚与当前版本查询

CREATE TABLE IF NOT EXISTS ont_version (
    version_id      VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    version_number  INTEGER NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    snapshot        JSONB NOT NULL,
    current         BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ont_version_tenant ON ont_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ont_version_status ON ont_version(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ont_version_current
    ON ont_version(tenant_id) WHERE current = TRUE;
