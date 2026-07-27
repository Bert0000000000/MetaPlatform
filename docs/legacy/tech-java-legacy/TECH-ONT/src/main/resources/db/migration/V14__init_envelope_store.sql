-- V14__init_envelope_store.sql
-- Phase 1 MVP - 主文档 §3 + ERR-1
-- 用于存 OntologyContextEnvelope（短期，30 分钟 TTL）

CREATE TABLE IF NOT EXISTS envelope_store (
    envelope_id            VARCHAR(64) PRIMARY KEY,
    tenant_id              VARCHAR(64) NOT NULL,
    user_id                VARCHAR(64) NOT NULL,
    run_id                 VARCHAR(64) NOT NULL,
    principal_json         JSONB NOT NULL,
    subject_json           JSONB NOT NULL,
    schema_json            JSONB NOT NULL,
    allowed_tools          JSONB NOT NULL,
    allowed_actions        JSONB NOT NULL,
    approval_required_actions JSONB,
    data_scopes            JSONB,
    permission_snapshot_id VARCHAR(64) NOT NULL,
    expires_at             TIMESTAMP WITH TIME ZONE NOT NULL,
    signature_alg          VARCHAR(16) NOT NULL,
    signature_kid          VARCHAR(64) NOT NULL,
    signature_value        TEXT NOT NULL,
    state                  VARCHAR(16) NOT NULL DEFAULT 'SIGNED',
    revoked_at             TIMESTAMP WITH TIME ZONE,
    revoked_by             VARCHAR(64),
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_envelope_state CHECK (state IN ('SIGNED','INJECTED','ACTIVE','EXPIRED','DESTROYED'))
);

CREATE INDEX idx_envelope_store_run ON envelope_store(run_id);
CREATE INDEX idx_envelope_store_tenant_user ON envelope_store(tenant_id, user_id);
CREATE INDEX idx_envelope_store_expires ON envelope_store(expires_at) WHERE state NOT IN ('DESTROYED','EXPIRED');

COMMENT ON TABLE envelope_store IS 'Phase 1 OntologyContextEnvelope 短期存储（ERR-1 / 主文档 §3）';
COMMENT ON COLUMN envelope_store.state IS 'SIGNED -> INJECTED -> ACTIVE -> EXPIRED -> DESTROYED';