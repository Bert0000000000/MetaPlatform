-- V9: P1-IAM-08 MFA 配置表（TOTP/SMS/EMAIL）
-- 约束：
--   - tenant_id NOT NULL，缺省值 tenant-default 由 Service 层填充
--   - secret_encrypted：TOTP 共享密钥（Base32），演示阶段直接存
--   - backup_codes：JSON 数组字符串，如 ["code1","code2"]
--   - mfa_type: TOTP / SMS / EMAIL
--   - 一个用户同类型仅允许一条启用记录（uk_mfa_tenant_user_type）

CREATE TABLE IF NOT EXISTS iam_mfa_config (
    id                  VARCHAR(64)    PRIMARY KEY,
    tenant_id           VARCHAR(64)    NOT NULL,
    user_id             VARCHAR(64)    NOT NULL,
    mfa_type            VARCHAR(16)    NOT NULL DEFAULT 'TOTP',
    secret_encrypted    TEXT,
    phone               VARCHAR(32),
    email               VARCHAR(128),
    enabled             BOOLEAN        NOT NULL DEFAULT FALSE,
    backup_codes        TEXT,
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_mfa_tenant_user_type UNIQUE (tenant_id, user_id, mfa_type),
    CONSTRAINT fk_mfa_user FOREIGN KEY (user_id) REFERENCES iam_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mfa_tenant_user ON iam_mfa_config(tenant_id, user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_mfa_user ON iam_mfa_config(user_id);
