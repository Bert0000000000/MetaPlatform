-- V5__init_run_events.sql
-- Phase 1 MVP - ERR-2 21 种 RunEvent

CREATE TABLE IF NOT EXISTS run_events (
    event_id        VARCHAR(64) PRIMARY KEY,
    run_id          VARCHAR(64) NOT NULL,
    task_id         VARCHAR(64),
    sub_agent_id    VARCHAR(64),
    parent_run_id   VARCHAR(64),
    type            VARCHAR(64) NOT NULL,
    ts              TIMESTAMP WITH TIME ZONE NOT NULL,
    trace_id        VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    envelope_id     VARCHAR(64),
    payload         JSONB NOT NULL,
    error_code      VARCHAR(64),
    seq             BIGINT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_type CHECK (type IN (
        'RUN_STARTED','RUN_PAUSED','RUN_RESUMED','RUN_FAILED','RUN_COMPLETED',
        'PLAN_CREATED','TASK_CREATED','CHECKPOINT_SAVED',
        'SUBAGENT_STARTED',
        'MODEL_STARTED','MODEL_COMPLETED',
        'TOOL_STARTED','TOOL_COMPLETED',
        'EVIDENCE_ATTACHED','CLAIM_PRODUCED','ARTIFACT_CREATED',
        'APPROVAL_REQUIRED','ACTION_PROPOSED','ACTION_GUARD_DECIDED',
        'ACTION_EXECUTED','ACTION_FAILED',
        'ONTOLOGY_EVENT_RECEIVED'
    )),
    CONSTRAINT chk_error_code_valid CHECK (
        error_code IS NULL OR error_code IN (
            'ENVELOPE_NOT_FOUND','ENVELOPE_EXPIRED','ENVELOPE_INVALID',
            'INSTRUCTION_TAMPERED','TOOL_NOT_IN_ALLOWLIST','TOOL_RESULT_LEAKED_FIELD',
            'OBJECT_ACCESS_DENIED','CONFLICT_CLAIM','MEMORY_WRITE_DENIED',
            'CANDIDATE_REJECTED','ARTIFACT_BLOCKED','ARTIFACT_REVOKED',
            'ENVELOPE_CARRIER_UNAVAILABLE'
        )
    ),
    CONSTRAINT fk_run_events_run FOREIGN KEY (run_id) REFERENCES agent_runs(run_id) ON DELETE RESTRICT
);

CREATE INDEX idx_run_events_run_ts ON run_events(run_id, ts);
CREATE UNIQUE INDEX idx_run_events_run_seq ON run_events(run_id, seq);
CREATE INDEX idx_run_events_type ON run_events(type);
CREATE INDEX idx_run_events_tenant_ts ON run_events(tenant_id, ts DESC);

COMMENT ON TABLE run_events IS 'Phase 1 RunEvent 全量事件（21 种枚举，ERR-2）';
COMMENT ON COLUMN run_events.seq IS '单 run 单调递增序号，确保 RE-4 不变量';