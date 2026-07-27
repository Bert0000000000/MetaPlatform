-- V9__init_evidence.sql
-- Phase 1 MVP - 主文档 §5.3 Evidence 持久化
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    ref TEXT NOT NULL,
    fragment TEXT,
    source_uri TEXT,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    captured_by VARCHAR(128) NOT NULL,
    concept VARCHAR(128),
    object_id VARCHAR(128),
    tool_call_id VARCHAR(128),
    envelope_id VARCHAR(64) NOT NULL,
    CONSTRAINT chk_evidence_type CHECK (type IN ('ONTOLOGY_OBJECT','ONTOLOGY_METRIC','ONTOLOGY_RELATION','DOCUMENT','KB_CHUNK','EXTERNAL','MODEL_DERIVED'))
);
CREATE INDEX idx_evidence_envelope ON evidence(envelope_id);
CREATE INDEX idx_evidence_captured_at ON evidence(captured_at DESC);
COMMENT ON TABLE evidence IS 'Phase 1 Evidence 记录（主文档 §5.3）；envelope_id 跨 schema 不建立 DB 外键';
