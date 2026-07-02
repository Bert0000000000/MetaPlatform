-- 角色表
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(64) NOT NULL,
    description VARCHAR(256),
    system_role BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- 角色-权限关联表
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, resource, action)
);

-- 用户-角色关联表
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID NOT NULL,
    UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
