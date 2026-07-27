CREATE TABLE dashboard_metric_configs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    metric_id VARCHAR(128) NOT NULL,
    metric_name VARCHAR(256),
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    size VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_dashboard_metric_configs_user_metric ON dashboard_metric_configs(user_id, metric_id);
CREATE INDEX idx_dashboard_metric_configs_user ON dashboard_metric_configs(user_id);
