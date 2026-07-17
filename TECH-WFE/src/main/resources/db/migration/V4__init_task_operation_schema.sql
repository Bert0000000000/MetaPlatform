-- ════════════════════════════════════════════════════════════
-- TECH-WFE V4: P1-WFE-10 任务高级操作相关表
--   - wfe_task_delegation：任务转交记录
--   - wfe_task_addsign：任务加签记录
--   - wfe_task_urge：任务催办记录
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_task_delegation (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    task_id         VARCHAR(64)   NOT NULL,
    from_user       VARCHAR(64)   NOT NULL,
    to_user         VARCHAR(64)   NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_delegation_task ON wfe_task_delegation (tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_wfe_delegation_to_user ON wfe_task_delegation (tenant_id, to_user);

CREATE TABLE IF NOT EXISTS wfe_task_addsign (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    task_id         VARCHAR(64)   NOT NULL,
    addsign_user    VARCHAR(64)   NOT NULL,
    reason          TEXT,
    status          VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_addsign_task ON wfe_task_addsign (tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_wfe_addsign_user ON wfe_task_addsign (tenant_id, addsign_user);

CREATE TABLE IF NOT EXISTS wfe_task_urge (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    task_id         VARCHAR(64)   NOT NULL,
    urged_user      VARCHAR(64)   NOT NULL,
    message         TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_urge_task ON wfe_task_urge (tenant_id, task_id);