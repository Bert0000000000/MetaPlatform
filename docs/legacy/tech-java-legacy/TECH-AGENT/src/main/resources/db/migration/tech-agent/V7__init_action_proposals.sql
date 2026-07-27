-- V6__init_action_proposals.sql
-- Phase 1 MVP - ERR-4 ActionProposal 占位 schema
-- 字段集锁定，Phase 3 落地扩展字段不破坏本表

CREATE TABLE IF NOT EXISTS action_proposals (
    proposal_id        VARCHAR(64) PRIMARY KEY,
    run_id             VARCHAR(64) NOT NULL,
    task_id            VARCHAR(64),
    action_code        VARCHAR(128) NOT NULL,
    target_objects     JSONB NOT NULL,
    parameters         JSONB NOT NULL,
    reason             TEXT NOT NULL,
    evidence_refs      JSONB NOT NULL,
    risk_level         VARCHAR(16) NOT NULL,
    approval_required  BOOLEAN NOT NULL,
    idempotency_key    VARCHAR(128) NOT NULL,
    status             VARCHAR(32) NOT NULL,
    decided_by         VARCHAR(128),
    decision_at        TIMESTAMP WITH TIME ZONE,
    decision_reason    TEXT,
    proposed_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_action_status CHECK (status IN ('PROPOSED','APPROVED','REJECTED','EXECUTED','FAILED','EXPIRED')),
    CONSTRAINT uq_idempotency UNIQUE (idempotency_key),
    CONSTRAINT chk_evidence_refs_nonempty CHECK (jsonb_array_length(evidence_refs) >= 1),
    CONSTRAINT fk_action_proposals_run FOREIGN KEY (run_id) REFERENCES agent_runs(run_id) ON DELETE RESTRICT
);

CREATE INDEX idx_action_proposals_run ON action_proposals(run_id);
CREATE INDEX idx_action_proposals_action_code ON action_proposals(action_code);
CREATE INDEX idx_action_proposals_status_expires ON action_proposals(status, expires_at)
    WHERE status NOT IN ('EXECUTED','FAILED','EXPIRED');
CREATE INDEX idx_action_proposals_idempotency ON action_proposals(idempotency_key);

COMMENT ON TABLE action_proposals IS 'Phase 1 ActionProposal 占位 schema（ERR-4）。AP-6：Phase 1 MVP 期间此表只写 DDL 不发 ACTION_PROPOSED 事件。';
COMMENT ON COLUMN action_proposals.status IS 'PROPOSED -> APPROVED|REJECTED -> EXECUTED|FAILED；或 PROPOSED -> EXPIRED';
COMMENT ON COLUMN action_proposals.idempotency_key IS '由 runId + actionCode + targetObjects + parameters 哈希派生，AP-2';