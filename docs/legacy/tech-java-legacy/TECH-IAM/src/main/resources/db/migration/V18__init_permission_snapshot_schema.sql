-- =============================================================================
-- V18: P0.2.1 PermissionSnapshot 数据模型
-- -----------------------------------------------------------------------------
-- 用于 Ontology-Native DeerFlow 的 OntologyContextEnvelope 权限快照缓存：
--   - 用户对当前 Object/Concept 的对象级权限
--   - 字段级可见性 / 脱敏列表
--   - 关系级可访问边
--   - Action 级白名单
--   - 数据范围 (DataScope)
--   - 签名（防篡改）
--   - TTL（5 分钟自动失效）
-- =============================================================================

CREATE TABLE IF NOT EXISTS iam_permission_snapshot (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    user_id         VARCHAR(64)    NOT NULL,
    subject_concept VARCHAR(64)    NOT NULL,
    subject_id      VARCHAR(64)    NOT NULL,
    snapshot_data   TEXT           NOT NULL,   -- JSON: 完整 PermissionSnapshot
    signature       VARCHAR(256)   NOT NULL,   -- HS256 签名
    expires_at      TIMESTAMP      NOT NULL,
    revoked         BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_snapshot UNIQUE (tenant_id, user_id, subject_concept, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_expires ON iam_permission_snapshot(expires_at) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_snapshot_tenant_user ON iam_permission_snapshot(tenant_id, user_id);

COMMENT ON TABLE  iam_permission_snapshot IS '权限快照：用于 Ontology Context Envelope 的对象级/字段级/关系级/Action 级权限缓存';
COMMENT ON COLUMN iam_permission_snapshot.snapshot_data IS 'JSON: {"allowedActions":[...], "deniedFields":[...], "allowedRelations":[...], "dataScope":"DEPT_AND_SUB", "rowFilter":"..."}';
