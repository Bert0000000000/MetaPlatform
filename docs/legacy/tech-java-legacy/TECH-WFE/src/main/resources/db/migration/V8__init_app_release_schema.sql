-- ════════════════════════════════════════════════════════════
-- TECH-WFE V8: V14-05 APP-APPHUB 灰度发布与发布审批相关表
--   - wfe_app_release: 应用发布记录表
--   - wfe_app_release_log: 发布操作日志表
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_app_release (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    app_id              VARCHAR(64)   NOT NULL,
    version             VARCHAR(64)   NOT NULL,
    release_notes       TEXT,
    strategy            VARCHAR(32)   NOT NULL DEFAULT 'FULL',
    gray_percent        INT           NOT NULL DEFAULT 0,
    gray_users          TEXT,
    gray_depts          TEXT,
    status              VARCHAR(32)   NOT NULL DEFAULT 'PENDING_APPROVAL',
    approval_status     VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
    process_instance_id VARCHAR(64),
    created_by          VARCHAR(64),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_apprel_tenant_app_version UNIQUE (tenant_id, app_id, version),
    CONSTRAINT chk_wfe_apprel_strategy CHECK (strategy IN ('FULL', 'GRAYSCALE')),
    CONSTRAINT chk_wfe_apprel_status CHECK (status IN ('PENDING_APPROVAL', 'PUBLISHED', 'REJECTED')),
    CONSTRAINT chk_wfe_apprel_approval_status CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_wfe_apprel_tenant_app ON wfe_app_release (tenant_id, app_id);
CREATE INDEX IF NOT EXISTS idx_wfe_apprel_process_instance ON wfe_app_release (process_instance_id);

CREATE TABLE IF NOT EXISTS wfe_app_release_log (
    id          VARCHAR(64)   PRIMARY KEY,
    release_id  VARCHAR(64)   NOT NULL,
    action      VARCHAR(64)   NOT NULL,
    operator    VARCHAR(64),
    remark      TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_apprel_log_release ON wfe_app_release_log (release_id);
