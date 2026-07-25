CREATE TABLE dashboard_deliverables (
    id BIGSERIAL PRIMARY KEY,
    deliverable_id VARCHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'DOCUMENT',
    source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL_UPLOADED',
    source_id VARCHAR(128),
    content_url VARCHAR(1024),
    description TEXT,
    tags VARCHAR(1024),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    share_token VARCHAR(128) UNIQUE,
    shared_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_dashboard_deliverables_user ON dashboard_deliverables(user_id);
CREATE INDEX idx_dashboard_deliverables_status ON dashboard_deliverables(status);
CREATE INDEX idx_dashboard_deliverables_type ON dashboard_deliverables(type);
CREATE INDEX idx_dashboard_deliverables_share_token ON dashboard_deliverables(share_token);
