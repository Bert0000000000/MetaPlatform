-- =============================================================================
-- V12: P1.3.1 Ontology Draft / Candidate Fact Schema
-- -----------------------------------------------------------------------------
-- Draft：草稿（业务用户或 LLM 抽取的候选事实集合），尚未生效。
-- CandidateFact：草稿中每个候选事实的单元。
-- CommitService：负责草稿 → 评审 → 发布 → 版本化。
-- =============================================================================

CREATE TABLE IF NOT EXISTS ont_draft (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    base_version    VARCHAR(32)    NOT NULL,                  -- 起草时的当前版本
    target_version  VARCHAR(32)    NOT NULL,                  -- 提交后产生的新版本
    draft_kind      VARCHAR(32)    NOT NULL DEFAULT 'CONCEPT', -- CONCEPT / OBJECT / METRIC / ACTION
    source          VARCHAR(64)    NOT NULL,                  -- USER / AGENT / SYSTEM
    source_run_id   VARCHAR(64),                              -- Agent Run ID
    summary         TEXT,                                     -- 草稿描述
    status          VARCHAR(16)    NOT NULL DEFAULT 'DRAFT',  -- DRAFT / PENDING_REVIEW / APPROVED / REJECTED / COMMITTED
    reviewer        VARCHAR(64),
    reviewed_at     TIMESTAMP,
    rejection_reason TEXT,
    committed_at    TIMESTAMP,
    commit_id       VARCHAR(64),
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_draft_status ON ont_draft(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_kind ON ont_draft(tenant_id, draft_kind);

CREATE TABLE IF NOT EXISTS ont_candidate_fact (
    id              VARCHAR(64)    PRIMARY KEY,
    draft_id        VARCHAR(64)    NOT NULL,
    concept_code    VARCHAR(64)    NOT NULL,
    object_id       VARCHAR(64),
    property        VARCHAR(128)   NOT NULL,
    proposed_value  TEXT,                                     -- JSON
    evidence_refs   TEXT,                                     -- JSON 数组
    confidence      DECIMAL(5,4)   NOT NULL DEFAULT 0,
    conflict_level  VARCHAR(16)    NOT NULL DEFAULT 'NONE',   -- NONE / LOW / MEDIUM / HIGH
    decision        VARCHAR(16)    NOT NULL DEFAULT 'PENDING',-- PENDING / ACCEPTED / REJECTED / MERGED
    merged_value    TEXT,
    reviewer        VARCHAR(64),
    CONSTRAINT uk_cf_draft_property UNIQUE (draft_id, concept_code, object_id, property),
    CONSTRAINT fk_cf_draft FOREIGN KEY (draft_id) REFERENCES ont_draft(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cf_concept ON ont_candidate_fact(concept_code, decision);

COMMENT ON TABLE  ont_draft IS 'Ontology 草稿：人类/LLM 抽取的候选事实集合，受 Commit Service 治理';
COMMENT ON TABLE  ont_candidate_fact IS 'Ontology 候选事实：每个待提交的属性变更';
COMMENT ON COLUMN ont_candidate_fact.conflict_level IS 'NONE / LOW / MEDIUM / HIGH；HIGH 必须人工审批';
