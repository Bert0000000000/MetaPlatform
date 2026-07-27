-- V12: P1-IAM-10 岗位表与用户岗位关联表

CREATE TABLE IF NOT EXISTS iam_position (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    name            VARCHAR(256)   NOT NULL,
    code            VARCHAR(128)   NOT NULL,
    level           INT            NOT NULL DEFAULT 1,
    parent_id       VARCHAR(64),
    description     TEXT,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_pos_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_pos_tenant_parent ON iam_position(tenant_id, parent_id, deleted);
CREATE INDEX IF NOT EXISTS idx_pos_tenant_level ON iam_position(tenant_id, level);