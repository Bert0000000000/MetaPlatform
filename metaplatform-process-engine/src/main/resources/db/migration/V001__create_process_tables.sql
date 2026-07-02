-- V001: Create process engine tables

CREATE TABLE IF NOT EXISTS process_definition (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    dsl_json TEXT NOT NULL,
    trigger_type VARCHAR(30),
    trigger_config TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_instance (
    id BIGSERIAL PRIMARY KEY,
    definition_id BIGINT NOT NULL REFERENCES process_definition(id),
    definition_code VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    current_node_id VARCHAR(100),
    initiator_id VARCHAR(100) NOT NULL,
    initiator_name VARCHAR(200),
    business_key VARCHAR(200),
    business_type VARCHAR(100),
    variables_json TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_task (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    task_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assignee_id VARCHAR(100),
    assignee_name VARCHAR(200),
    result VARCHAR(100),
    form_data TEXT,
    comment TEXT,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_history (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    node_id VARCHAR(100),
    actor_id VARCHAR(100),
    actor_name VARCHAR(200),
    detail TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_variable (
    id BIGSERIAL PRIMARY KEY,
    instance_id BIGINT NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value TEXT,
    type VARCHAR(20) NOT NULL,
    UNIQUE (instance_id, name)
);

CREATE TABLE IF NOT EXISTS process_sla (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES process_task(id) ON DELETE CASCADE,
    duration VARCHAR(50) NOT NULL,
    escalation VARCHAR(30),
    due_date TIMESTAMP NOT NULL,
    breached BOOLEAN DEFAULT FALSE,
    breached_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_process_instance_definition ON process_instance(definition_code);
CREATE INDEX IF NOT EXISTS idx_process_instance_status ON process_instance(status);
CREATE INDEX IF NOT EXISTS idx_process_instance_initiator ON process_instance(initiator_id);
CREATE INDEX IF NOT EXISTS idx_process_instance_business ON process_instance(business_type, business_key);
CREATE INDEX IF NOT EXISTS idx_process_task_instance ON process_task(instance_id);
CREATE INDEX IF NOT EXISTS idx_process_task_assignee ON process_task(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_process_task_due ON process_task(due_date) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_process_history_instance ON process_history(instance_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_process_history_actor ON process_history(actor_id);
