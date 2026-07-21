CREATE TABLE IF NOT EXISTS iam_user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL UNIQUE,
    language VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    date_format VARCHAR(64) NOT NULL DEFAULT 'YYYY-MM-DD HH:mm:ss',
    default_page VARCHAR(128) NOT NULL DEFAULT '/dashboard',
    theme VARCHAR(16) NOT NULL DEFAULT 'light',
    layout TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iam_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    device VARCHAR(255) NOT NULL,
    ip VARCHAR(64) NOT NULL,
    location VARCHAR(128),
    last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_user_sessions_user_id ON iam_user_sessions(user_id);
