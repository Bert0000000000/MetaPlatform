CREATE TABLE copilot_chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(256),
    status VARCHAR(16) DEFAULT 'ACTIVE',
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_copilot_sessions_user ON copilot_chat_sessions(user_id, last_message_at DESC);

CREATE TABLE copilot_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    message_id VARCHAR(64) NOT NULL UNIQUE,
    session_id VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    content TEXT,
    citations TEXT,
    agent_calls TEXT,
    rating INT,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_copilot_messages_session ON copilot_chat_messages(session_id, created_at);

CREATE TABLE copilot_scheduling_records (
    id BIGSERIAL PRIMARY KEY,
    record_id VARCHAR(64) NOT NULL UNIQUE,
    session_id VARCHAR(64),
    message_id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    query TEXT,
    intent_type VARCHAR(32),
    business_domain VARCHAR(64),
    agent_ids TEXT,
    status VARCHAR(32) NOT NULL,
    latency_ms BIGINT,
    result TEXT,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP
);
CREATE INDEX idx_copilot_scheduling_user ON copilot_scheduling_records(user_id, started_at DESC);
CREATE INDEX idx_copilot_scheduling_status ON copilot_scheduling_records(status);