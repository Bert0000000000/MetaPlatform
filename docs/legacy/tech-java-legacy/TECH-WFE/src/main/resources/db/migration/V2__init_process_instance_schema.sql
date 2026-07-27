-- ════════════════════════════════════════════════════════════
-- TECH-WFE V2: 流程实例表结构
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_process_instance (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    process_definition_id   VARCHAR(64)   NOT NULL,
    process_key             VARCHAR(128)  NOT NULL,
    business_key            VARCHAR(128),
    status                  VARCHAR(16)   NOT NULL DEFAULT 'RUNNING',
    start_user_id           VARCHAR(64),
    variables               TEXT,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_wfe_pi_process_definition
        FOREIGN KEY (process_definition_id) REFERENCES wfe_process_definition(id)
);

CREATE INDEX IF NOT EXISTS idx_wfe_pi_tenant_status ON wfe_process_instance (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wfe_pi_definition ON wfe_process_instance (process_definition_id);
CREATE INDEX IF NOT EXISTS idx_wfe_pi_business_key ON wfe_process_instance (business_key);
