-- =============================================================================
-- TECH-ACTION V1: ActionProposal 数据模型
-- =============================================================================

CREATE TABLE IF NOT EXISTS action_proposal (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    run_id          VARCHAR(64)    NOT NULL,
    action_code     VARCHAR(128)   NOT NULL,
    target_object_id VARCHAR(64),
    concept_code    VARCHAR(64),
    parameters      TEXT,
    risk_level      VARCHAR(16)    NOT NULL,
    idempotency_key VARCHAR(128),
    requires_approval BOOLEAN      NOT NULL DEFAULT FALSE,
    status          VARCHAR(16)    NOT NULL DEFAULT 'PROPOSED',
    approver        VARCHAR(64),
    approval_id     VARCHAR(64),
    executed_at     TIMESTAMP,
    error_message   TEXT,
    evidence_refs   TEXT,
    reason          TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposal_run ON action_proposal(run_id);
CREATE INDEX IF NOT EXISTS idx_proposal_status ON action_proposal(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_proposal_idem ON action_proposal(idempotency_key);

-- 幂等执行记录表（防止重复执行）
CREATE TABLE IF NOT EXISTS action_execution (
    id              VARCHAR(64)    PRIMARY KEY,
    proposal_id     VARCHAR(64)    NOT NULL,
    tenant_id       VARCHAR(64)    NOT NULL,
    idempotency_key VARCHAR(128)   NOT NULL,
    status          VARCHAR(16)    NOT NULL,
    result          TEXT,
    executed_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_execution_idem UNIQUE (idempotency_key)
);
