-- V7__init_claim_records.sql
-- Phase 1 MVP - 主文档 §5.2 ClaimRecord

CREATE TABLE IF NOT EXISTS claim_records (
    claim_id        VARCHAR(64) PRIMARY KEY,
    run_id          VARCHAR(64) NOT NULL,
    task_id         VARCHAR(64),
    type            VARCHAR(32) NOT NULL,
    content         TEXT NOT NULL,
    confidence      NUMERIC(4,3) NOT NULL,
    evidence_refs   JSONB NOT NULL,
    generated_by_agent_id VARCHAR(128) NOT NULL,
    generated_by_model   VARCHAR(128) NOT NULL,
    tool_call_ids   JSONB,
    prompt_snapshot_id VARCHAR(64),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_claim_type CHECK (type IN ('FACT','INFERENCE','RECOMMENDATION')),
    CONSTRAINT chk_claim_confidence CHECK (confidence >= 0 AND confidence <= 1),
    -- C1: FACT 必须 ≥1 条 evidence
    CONSTRAINT chk_fact_has_evidence CHECK (
        type <> 'FACT' OR jsonb_array_length(evidence_refs) >= 1
    ),
    -- C2: RECOMMENDATION confidence 必须 < 1
    CONSTRAINT chk_recommendation_conf CHECK (
        type <> 'RECOMMENDATION' OR confidence < 1.0
    ),
    CONSTRAINT fk_claim_run FOREIGN KEY (run_id) REFERENCES agent_runs(run_id) ON DELETE RESTRICT
);

CREATE INDEX idx_claim_records_run ON claim_records(run_id);
CREATE INDEX idx_claim_records_type ON claim_records(type);
CREATE INDEX idx_claim_records_created ON claim_records(created_at DESC);

COMMENT ON TABLE claim_records IS 'Phase 1 Claim 记录（主文档 §5.2）；每行绑定 runId 与 evidenceRefs';
COMMENT ON COLUMN claim_records.evidence_refs IS '≥1（FACT 强制）；RECOMMENDATION confidence < 1';