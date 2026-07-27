-- V5: P1-IAM-03 数据权限配置表
-- 实现行级（data_scope）与列级（column_filter）数据权限控制。
-- 约束：
--   - tenant_id NOT NULL，缺省值 tenant-default 由 Service 层填充
--   - resource_id 为 NULL 表示通配该 resource_type 下的所有资源
--   - data_scope: ALL / DEPT / DEPT_AND_SUB / SELF
--   - column_filter: JSON 数组字符串，如 ["salary","id_card"]，为列级脱敏配置
--   - effect: ALLOW / DENY（DENY 否决优先）
--   - 审计字段 created_at / updated_at / created_by / updated_by / deleted / deleted_at

CREATE TABLE IF NOT EXISTS iam_data_permission (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    role_id         VARCHAR(64)    NOT NULL,
    resource_type   VARCHAR(64)    NOT NULL,
    resource_id     VARCHAR(64),
    data_scope      VARCHAR(16)    NOT NULL DEFAULT 'SELF',
    column_filter   TEXT,
    effect          VARCHAR(8)     NOT NULL DEFAULT 'ALLOW',
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_dp_tenant_role_resource UNIQUE (tenant_id, role_id, resource_type, resource_id),
    CONSTRAINT fk_dp_role FOREIGN KEY (role_id) REFERENCES iam_role(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dp_tenant_role ON iam_data_permission(tenant_id, role_id, deleted);
CREATE INDEX IF NOT EXISTS idx_dp_tenant_resource ON iam_data_permission(tenant_id, resource_type, deleted);
