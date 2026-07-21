-- V7: 本体自动发现任务表（Task 3.3 - V12-03 本体发现）
-- 记录每次本体自动发现任务的执行状态与结果

CREATE TABLE IF NOT EXISTS ont_discovery_task (
    id            VARCHAR(64)  PRIMARY KEY,
    tenant_id     VARCHAR(64),
    source_id     VARCHAR(64)  NOT NULL,
    source_type   VARCHAR(32)  NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    result_json   TEXT,
    error_message VARCHAR(2048),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ont_discovery_tenant ON ont_discovery_task(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ont_discovery_source ON ont_discovery_task(source_id);
CREATE INDEX IF NOT EXISTS idx_ont_discovery_status ON ont_discovery_task(status);