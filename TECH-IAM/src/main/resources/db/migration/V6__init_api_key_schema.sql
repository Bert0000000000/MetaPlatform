-- V6: P1-IAM-06 API Key 管理表
-- 为平台用户颁发 API Key，用于服务间调用或程序化访问。
-- 约束：
--   - tenant_id NOT NULL，缺省值 tenant-default 由 Service 层填充
--   - key_prefix：API Key 前 8 位，用于展示与识别（不泄露完整 Key）
--   - key_hash：API Key 的 SHA-256 哈希，用于验证时比对（不存储明文）
--   - scopes：JSON 数组字符串，如 ["ont:read","iam:write"]，定义权限范围
--   - status: ACTIVE / REVOKED（吊销后不可恢复）
--   - expires_at / last_used_at 可为 NULL

CREATE TABLE IF NOT EXISTS iam_api_keys (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    name            VARCHAR(128)   NOT NULL,
    key_prefix      VARCHAR(8)     NOT NULL,
    key_hash        VARCHAR(128)   NOT NULL,
    user_id         VARCHAR(64)    NOT NULL,
    scopes          TEXT,
    status          VARCHAR(16)    NOT NULL DEFAULT 'ACTIVE',
    expires_at      TIMESTAMP,
    last_used_at    TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_api_key_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT fk_api_key_user FOREIGN KEY (user_id) REFERENCES iam_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_api_key_tenant ON iam_api_keys(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON iam_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_user ON iam_api_keys(user_id);
