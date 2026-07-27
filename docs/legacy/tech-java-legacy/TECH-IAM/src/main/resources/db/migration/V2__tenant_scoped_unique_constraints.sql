-- V2: 对齐 SPEC（3.6.1 用户表），将 username/email 唯一约束改为 (tenant_id, x) 复合唯一
-- 背景：V1 把 username/email 设为全局唯一索引，导致跨租户同名用户无法共存
-- SPEC 第 3574 行：UNIQUE (tenant_id, username)

ALTER TABLE iam_users DROP CONSTRAINT IF EXISTS iam_users_username_key;
ALTER TABLE iam_users DROP CONSTRAINT IF EXISTS iam_users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS uk_iam_users_tenant_username
    ON iam_users(tenant_id, username);

CREATE UNIQUE INDEX IF NOT EXISTS uk_iam_users_tenant_email
    ON iam_users(tenant_id, email)
    WHERE email IS NOT NULL;

-- 兼容保留单列索引（查询辅助）
CREATE INDEX IF NOT EXISTS idx_iam_users_username ON iam_users(username);
CREATE INDEX IF NOT EXISTS idx_iam_users_email ON iam_users(email);
