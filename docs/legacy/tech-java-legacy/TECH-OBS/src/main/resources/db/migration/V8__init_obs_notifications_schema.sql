CREATE TABLE IF NOT EXISTS obs_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    link VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_notifications_user_id ON obs_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_obs_notifications_user_read ON obs_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_obs_notifications_created_at ON obs_notifications(created_at DESC);
