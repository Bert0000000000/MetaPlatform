-- V16: V13-06 APP-MCPHUB ABAC 权限策略表
-- 支持基于属性的访问控制（ABAC）策略：条件表达式、生效时间、工具范围等。

CREATE TABLE IF NOT EXISTS iam_policy (
    id                      VARCHAR(64)     PRIMARY KEY,
    tenant_id               VARCHAR(64)     NOT NULL,
    name                    VARCHAR(256)    NOT NULL,
    subject_type            VARCHAR(16)     NOT NULL,
    subject_id              VARCHAR(64)     NOT NULL,
    resource_type           VARCHAR(64)     NOT NULL,
    resource_ids            TEXT            NOT NULL,
    action                  VARCHAR(64)     NOT NULL,
    effect                  VARCHAR(16)     NOT NULL DEFAULT 'ALLOW',
    condition_expression    TEXT,
    effective_start_at      TIMESTAMP,
    effective_end_at        TIMESTAMP,
    priority                INT             NOT NULL DEFAULT 0,
    enabled                 BOOLEAN         NOT NULL DEFAULT TRUE,
    version                 INT             NOT NULL DEFAULT 1,
    deleted                 BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              VARCHAR(64),
    updated_by              VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_policy_tenant_subject ON iam_policy(tenant_id, subject_type, subject_id, deleted);
CREATE INDEX IF NOT EXISTS idx_policy_tenant_resource ON iam_policy(tenant_id, resource_type, deleted);
CREATE INDEX IF NOT EXISTS idx_policy_tenant_enabled ON iam_policy(tenant_id, enabled, deleted);
