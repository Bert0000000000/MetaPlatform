CREATE TABLE dashboard_shortcuts (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    icon VARCHAR(128),
    path VARCHAR(512) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_dashboard_shortcuts_user ON dashboard_shortcuts(user_id);

CREATE TABLE dashboard_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    resource_name VARCHAR(256),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_dashboard_favorites_user ON dashboard_favorites(user_id);

CREATE TABLE dashboard_recent_visits (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    resource_name VARCHAR(256),
    visited_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_dashboard_recent_user ON dashboard_recent_visits(user_id, visited_at DESC);
