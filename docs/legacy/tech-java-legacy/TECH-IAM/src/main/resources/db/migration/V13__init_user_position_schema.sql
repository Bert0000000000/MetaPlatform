-- V13: P1-IAM-10 用户岗位关联表（按部门维度承载岗位关系）

CREATE TABLE IF NOT EXISTS iam_user_position (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    user_id         VARCHAR(64)    NOT NULL,
    position_id     VARCHAR(64)    NOT NULL,
    department_id   VARCHAR(64)    NOT NULL,
    is_primary      BOOLEAN        NOT NULL DEFAULT FALSE,
    start_date      DATE,
    end_date        DATE,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_up_tenant_user_pos_dept UNIQUE (tenant_id, user_id, position_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_up_tenant_user ON iam_user_position(tenant_id, user_id, deleted);
CREATE INDEX IF NOT EXISTS idx_up_tenant_pos ON iam_user_position(tenant_id, position_id, deleted);
CREATE INDEX IF NOT EXISTS idx_up_tenant_dept ON iam_user_position(tenant_id, department_id, deleted);
CREATE INDEX IF NOT EXISTS idx_up_primary ON iam_user_position(tenant_id, user_id, is_primary);