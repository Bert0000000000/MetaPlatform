-- Parallel token table for tracking parallel gateway branch execution
CREATE TABLE parallel_token (
    id              BIGSERIAL PRIMARY KEY,
    instance_id     BIGINT NOT NULL,
    gateway_node_id VARCHAR(255) NOT NULL,
    branch_id       VARCHAR(255) NOT NULL,
    target_node_id  VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP,

    CONSTRAINT fk_parallel_token_instance
        FOREIGN KEY (instance_id) REFERENCES process_instance(id)
);

CREATE INDEX idx_parallel_token_instance ON parallel_token(instance_id);
CREATE INDEX idx_parallel_token_instance_gateway ON parallel_token(instance_id, gateway_node_id);
CREATE INDEX idx_parallel_token_status ON parallel_token(status);
