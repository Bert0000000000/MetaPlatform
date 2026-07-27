CREATE TABLE dw_kb_binding (
    id BIGSERIAL PRIMARY KEY,
    binding_id VARCHAR(64) NOT NULL UNIQUE,
    employee_id VARCHAR(64) NOT NULL,
    kb_id VARCHAR(64) NOT NULL,
    retrieval_config_id VARCHAR(64),
    priority INT DEFAULT 0,
    status VARCHAR(16) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, kb_id)
);
CREATE INDEX idx_dw_kb_binding_emp ON dw_kb_binding(employee_id);

CREATE TABLE dw_retrieval_config (
    id BIGSERIAL PRIMARY KEY,
    config_id VARCHAR(64) NOT NULL UNIQUE,
    employee_id VARCHAR(64) NOT NULL UNIQUE,
    top_k INT DEFAULT 10,
    score_threshold NUMERIC(3,2) DEFAULT 0.70,
    enable_rerank BOOLEAN DEFAULT TRUE,
    max_citations INT DEFAULT 5,
    enable_streaming BOOLEAN DEFAULT TRUE,
    strategy VARCHAR(16) DEFAULT 'HYBRID',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);