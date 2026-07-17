-- V8: P1-IAM-08 SSO 配置表（OAuth2/OIDC/SAML）
-- 约束：
--   - tenant_id NOT NULL，缺省值 tenant-default 由 Service 层填充
--   - client_secret_encrypted：客户端密文（演示阶段直接存明文/可逆编码，生产应接 KMS）
--   - config：JSON 字符串（issuer/discoveryUrl/extra params），TEXT 存储，与既有 scopes/actions 约定一致
--   - provider_type: OAUTH2 / OIDC / SAML
--   - 沿用既有审计字段：version/deleted/deleted_at/created_by/updated_by

CREATE TABLE IF NOT EXISTS iam_sso_config (
    id                      VARCHAR(64)    PRIMARY KEY,
    tenant_id               VARCHAR(64)    NOT NULL,
    provider_name           VARCHAR(128)   NOT NULL,
    provider_type           VARCHAR(16)    NOT NULL DEFAULT 'OAUTH2',
    client_id               VARCHAR(256),
    client_secret_encrypted TEXT,
    redirect_uri            VARCHAR(512),
    scopes                  VARCHAR(512),
    config                  TEXT,
    enabled                 BOOLEAN        NOT NULL DEFAULT TRUE,
    version                 INT            NOT NULL DEFAULT 1,
    deleted                 BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    created_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              VARCHAR(64),
    updated_by              VARCHAR(64),
    CONSTRAINT uk_sso_tenant_name UNIQUE (tenant_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_sso_tenant_type ON iam_sso_config(tenant_id, provider_type, enabled, deleted);
CREATE INDEX IF NOT EXISTS idx_sso_tenant_enabled ON iam_sso_config(tenant_id, enabled, deleted);
