-- V8__init_agent_artifacts.sql
-- Phase 1 MVP - 主文档 §5.6 + 契约 C
-- 在已有 agent_artifact 表上追加 attestation 字段，保留向后兼容
-- 原 V8 设计为新建 agent_artifacts 表，但与已有 agent_artifact 表字段重叠
-- 改方案：ALTER agent_artifact 追加 sha256 / scan_status / signed_url / revoked 等治理字段

ALTER TABLE agent_artifact
    ADD COLUMN IF NOT EXISTS sha256                  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS scan_status             VARCHAR(16) DEFAULT 'CLEAN',
    ADD COLUMN IF NOT EXISTS flagged_reasons         TEXT,
    ADD COLUMN IF NOT EXISTS produced_by_skill_id    VARCHAR(128),
    ADD COLUMN IF NOT EXISTS evidence_refs           TEXT,
    ADD COLUMN IF NOT EXISTS signed_url              TEXT,
    ADD COLUMN IF NOT EXISTS signed_url_expires_at   TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS revoked                 BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS revoked_at              TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS revoked_by              VARCHAR(128),
    ADD COLUMN IF NOT EXISTS revoked_reason          TEXT,
    ADD COLUMN IF NOT EXISTS expires_at              TIMESTAMP WITH TIME ZONE;

-- 原有 CHECK 约束（scan_status）— 在原 V1 schema 里可能没设，这里补上
DO $$ BEGIN
    ALTER TABLE agent_artifact
        ADD CONSTRAINT chk_scan_status CHECK (scan_status IN ('CLEAN','FLAGGED','BLOCKED'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- C4: BLOCKED 必撤销
DO $$ BEGIN
    ALTER TABLE agent_artifact
        ADD CONSTRAINT chk_blocked_handling CHECK (
            scan_status <> 'BLOCKED' OR revoked = TRUE
        );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_artifact_scan
    ON agent_artifact(scan_status) WHERE scan_status <> 'CLEAN';
CREATE INDEX IF NOT EXISTS idx_agent_artifact_revoked
    ON agent_artifact(revoked) WHERE revoked = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_artifact_evidence_refs
    ON agent_artifact USING gin (evidence_refs::jsonb) WHERE evidence_refs IS NOT NULL;

COMMENT ON COLUMN agent_artifact.sha256 IS '主文档 §5.6 - Artifact SHA256 校验';
COMMENT ON COLUMN agent_artifact.scan_status IS 'CLEAN / FLAGGED / BLOCKED；BLOCKED 必撤销（C4）';
COMMENT ON COLUMN agent_artifact.signed_url IS '当前可用签名 URL；1 小时 TTL（主文档 §3.5 设计）';
COMMENT ON COLUMN agent_artifact.revoked IS '撤销后 signed_url 立即失效（C5）';
COMMENT ON COLUMN agent_artifact.evidence_refs IS 'TEXT 存 JSON 数组；GIN 索引支持反查';