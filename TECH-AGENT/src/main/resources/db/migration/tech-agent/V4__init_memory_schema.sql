-- TECH-AGENT V3: 企业长期记忆（P7.3）
CREATE TABLE IF NOT EXISTS agent_memory (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    memory_kind     VARCHAR(32)    NOT NULL,            -- EPISODIC / SEMANTIC / ORGANIZATIONAL
    scope           VARCHAR(128),
    content         TEXT           NOT NULL,
    tags            TEXT,                                -- JSON 数组
    source_run_id   VARCHAR(64),
    confidence      DECIMAL(5,4)   NOT NULL DEFAULT 1.0,
    pii_redacted    BOOLEAN        NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_memory_scope ON agent_memory(tenant_id, scope, memory_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON agent_memory(expires_at);
