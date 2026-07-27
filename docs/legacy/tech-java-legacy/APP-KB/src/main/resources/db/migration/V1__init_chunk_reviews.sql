CREATE TABLE kb_chunk_reviews (
    id BIGSERIAL PRIMARY KEY,
    review_id VARCHAR(64) NOT NULL UNIQUE,
    kb_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    chunk_id VARCHAR(64) NOT NULL,
    content TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMP,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_kb_chunk_reviews_kb ON kb_chunk_reviews(kb_id, status);
CREATE INDEX idx_kb_chunk_reviews_doc ON kb_chunk_reviews(document_id);

CREATE TABLE kb_version_diffs (
    id BIGSERIAL PRIMARY KEY,
    diff_id VARCHAR(64) NOT NULL UNIQUE,
    kb_id VARCHAR(64) NOT NULL,
    from_version VARCHAR(32),
    to_version VARCHAR(32) NOT NULL,
    diff_type VARCHAR(32) NOT NULL,
    changes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_kb_version_diffs_kb ON kb_version_diffs(kb_id, created_at DESC);
