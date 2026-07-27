CREATE TABLE IF NOT EXISTS obs_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    user_id VARCHAR(64) NOT NULL UNIQUE,
    approval BOOLEAN NOT NULL DEFAULT true,
    task BOOLEAN NOT NULL DEFAULT true,
    system BOOLEAN NOT NULL DEFAULT true,
    mention BOOLEAN NOT NULL DEFAULT true,
    alert BOOLEAN NOT NULL DEFAULT true,
    email BOOLEAN NOT NULL DEFAULT false,
    push BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_notification_settings_user_id ON obs_notification_settings(user_id);
