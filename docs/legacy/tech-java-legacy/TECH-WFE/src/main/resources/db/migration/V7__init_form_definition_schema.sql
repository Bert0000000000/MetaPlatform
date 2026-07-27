-- ════════════════════════════════════════════════════════════
-- TECH-WFE V7: V13-13 APP-APPHUB 高级表单能力表
--   - wfe_form_definition: 表单全局设置 / 联动规则 / 脚本
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_form_definition (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    app_id          VARCHAR(64),
    global_settings TEXT,
    linkage_rules   TEXT,
    scripts         TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_form_tenant_module UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wfe_form_tenant ON wfe_form_definition (tenant_id);
