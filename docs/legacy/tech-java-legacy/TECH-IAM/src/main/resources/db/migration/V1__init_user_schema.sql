CREATE TABLE IF NOT EXISTS iam_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(64),
    phone VARCHAR(32),
    avatar_url VARCHAR(255),
    status VARCHAR(16) NOT NULL DEFAULT 'ENABLED',
    require_password_reset BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_users_username ON iam_users(username);
CREATE INDEX IF NOT EXISTS idx_iam_users_email ON iam_users(email);
CREATE INDEX IF NOT EXISTS idx_iam_users_status ON iam_users(status);
CREATE INDEX IF NOT EXISTS idx_iam_users_tenant_id ON iam_users(tenant_id);
