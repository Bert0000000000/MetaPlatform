-- =============================================================================
-- V11: P1.1.5 Ontology Event Schema + Version Diff 增强
-- -----------------------------------------------------------------------------
-- 业务事件：用于 Phase 7 的事件触发数字员工。
-- Version Diff：保存 Ontology 每次 Commit 的前后差异快照。
-- =============================================================================

CREATE TABLE IF NOT EXISTS ont_domain_event (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    event_code      VARCHAR(128)   NOT NULL,    -- 如 Contract.expiring / Order.cancelled
    concept_code    VARCHAR(64)    NOT NULL,
    object_id       VARCHAR(64),
    payload         TEXT,                        -- JSON
    occurred_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consumed        BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_domain_event UNIQUE (tenant_id, event_code, object_id, occurred_at)
);

CREATE INDEX IF NOT EXISTS idx_domain_event_code ON ont_domain_event(tenant_id, event_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_event_pending ON ont_domain_event(tenant_id, consumed) WHERE consumed = FALSE;

COMMENT ON TABLE ont_domain_event IS 'Ontology 业务事件：由业务系统或 Agent 触发，用于事件驱动数字员工';

-- Version Diff：把 commit 的前后 Concept/Object 状态做快照保存
CREATE TABLE IF NOT EXISTS ont_version_diff (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    from_version    VARCHAR(32),
    to_version      VARCHAR(32)    NOT NULL,
    diff_type       VARCHAR(32)    NOT NULL,   -- CONCEPT_ADDED / CONCEPT_MODIFIED / OBJECT_CHANGED ...
    changes         TEXT           NOT NULL,   -- JSON 结构化 diff
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_version_diff UNIQUE (tenant_id, from_version, to_version, diff_type)
);

CREATE INDEX IF NOT EXISTS idx_version_diff_to ON ont_version_diff(tenant_id, to_version, created_at DESC);
