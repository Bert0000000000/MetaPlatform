-- =============================================================================
-- V13: P1.3 Ontology Commit 表
-- -----------------------------------------------------------------------------
-- 每次成功发布的 Commit 都形成一份不可变记录（含 approver / 证据）。
-- 与 ont_version_diff 配合可完整还原版本演化。
-- =============================================================================

CREATE TABLE IF NOT EXISTS ont_commit (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    version         VARCHAR(32)    NOT NULL,
    previous_version VARCHAR(32),
    draft_id        VARCHAR(64)    NOT NULL,
    author          VARCHAR(64)    NOT NULL,
    approver        VARCHAR(64),
    evidence_refs   TEXT,
    change_count    INT            NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_commit_version UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_commit_created ON ont_commit(tenant_id, created_at DESC);
