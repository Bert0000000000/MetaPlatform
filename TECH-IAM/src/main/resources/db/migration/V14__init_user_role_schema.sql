-- V14: P1-IAM-10 用户-角色关联表（与 iam_role 多对多）

CREATE TABLE IF NOT EXISTS iam_user_role (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    user_id         VARCHAR(64)    NOT NULL,
    role_id         VARCHAR(64)    NOT NULL,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_ur_tenant_user_role UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_ur_tenant_user ON iam_user_role(tenant_id, user_id, deleted);
CREATE INDEX IF NOT EXISTS idx_ur_tenant_role ON iam_user_role(tenant_id, role_id, deleted);