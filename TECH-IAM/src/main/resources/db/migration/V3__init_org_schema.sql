-- V3: Phase 2 部门与权限基础
-- 对齐 SPEC（4.3 iam_department、4.5 iam_user_department、4.6 iam_role、4.7 iam_permission、4.8 iam_role_permission）
-- 约束：
--   - 所有 tenant_id NOT NULL；缺省值 tenant-default 由 Service 层填充，不在 DB DEFAULT 中硬编码
--   - 所有外键 ON DELETE RESTRICT（Phase 2 强一致策略；后续 Sprint 评估是否改 RESTRICT -> CASCADE）
--   - 所有业务唯一键按 (tenant_id, code) 复合模式
--   - 所有审计字段 created_at / updated_at / created_by / updated_by / deleted / deleted_at

-- ============================================================
-- iam_department：部门表
-- ============================================================
CREATE TABLE IF NOT EXISTS iam_department (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    dept_code       VARCHAR(128)   NOT NULL,
    dept_name       VARCHAR(256)   NOT NULL,
    parent_id       VARCHAR(64),
    parent_path     VARCHAR(1024),
    full_path       VARCHAR(1024)  NOT NULL,
    level           INT            NOT NULL,
    sort_order      INT            NOT NULL DEFAULT 0,
    leader_id       VARCHAR(64),
    description     TEXT,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_dept_tenant_code UNIQUE (tenant_id, dept_code),
    CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES iam_department(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dept_tenant_parent ON iam_department(tenant_id, parent_id, deleted);
CREATE INDEX IF NOT EXISTS idx_dept_tenant_level ON iam_department(tenant_id, level);
CREATE INDEX IF NOT EXISTS idx_dept_leader ON iam_department(tenant_id, leader_id);

-- ============================================================
-- iam_user_department：用户-部门关联表（一期：暂不引入岗位，Phase 2 收敛到最小可用）
-- ============================================================
CREATE TABLE IF NOT EXISTS iam_user_department (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    user_id         VARCHAR(64)    NOT NULL,
    department_id   VARCHAR(64)    NOT NULL,
    position_id     VARCHAR(64),
    is_primary      BOOLEAN        NOT NULL DEFAULT FALSE,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_ud_tenant_user_dept UNIQUE (tenant_id, user_id, department_id),
    CONSTRAINT fk_ud_user FOREIGN KEY (user_id) REFERENCES iam_users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ud_department FOREIGN KEY (department_id) REFERENCES iam_department(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ud_tenant_user ON iam_user_department(tenant_id, user_id, deleted);
CREATE INDEX IF NOT EXISTS idx_ud_tenant_dept ON iam_user_department(tenant_id, department_id, deleted);
CREATE INDEX IF NOT EXISTS idx_ud_primary ON iam_user_department(tenant_id, user_id, is_primary);

-- ============================================================
-- iam_role：角色表
-- ============================================================
CREATE TABLE IF NOT EXISTS iam_role (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    role_code       VARCHAR(128)   NOT NULL,
    role_name       VARCHAR(256)   NOT NULL,
    role_type       VARCHAR(32)    NOT NULL DEFAULT 'CUSTOM',
    description     TEXT,
    data_scope      VARCHAR(32)    NOT NULL DEFAULT 'SELF',
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_role_tenant_code UNIQUE (tenant_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_role_tenant_type ON iam_role(tenant_id, role_type, enabled, deleted);

-- ============================================================
-- iam_permission：权限定义表
-- ============================================================
CREATE TABLE IF NOT EXISTS iam_permission (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    permission_code VARCHAR(256)   NOT NULL,
    permission_name VARCHAR(256)   NOT NULL,
    resource_type   VARCHAR(64)    NOT NULL,
    resource_id     VARCHAR(64),
    actions         TEXT           NOT NULL,
    effect          VARCHAR(16)    NOT NULL DEFAULT 'ALLOW',
    description     TEXT,
    conditions      TEXT,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_perm_tenant_code UNIQUE (tenant_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_perm_tenant_resource ON iam_permission(tenant_id, resource_type, deleted);
CREATE INDEX IF NOT EXISTS idx_perm_tenant_effect ON iam_permission(tenant_id, effect, deleted);

-- ============================================================
-- iam_role_permission：角色-权限关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS iam_role_permission (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    role_id         VARCHAR(64)    NOT NULL,
    permission_id   VARCHAR(64)    NOT NULL,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),
    updated_by      VARCHAR(64),
    CONSTRAINT uk_rp_tenant_role_perm UNIQUE (tenant_id, role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES iam_role(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES iam_permission(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rp_role ON iam_role_permission(role_id);
CREATE INDEX IF NOT EXISTS idx_rp_permission ON iam_role_permission(permission_id);