-- ════════════════════════════════════════════════════════════
-- TECH-WFE V1: 流程定义表结构
-- 注意：Flowable 自带的 ACT_RE_* / ACT_RU_* / ACT_HI_* 表
--       由 Flowable 引擎自动创建（flowable.database-schema-update=true），
--       此处仅创建业务扩展表。
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_process_definition (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    process_key     VARCHAR(128)  NOT NULL,
    name            VARCHAR(256)  NOT NULL,
    version         INT           NOT NULL DEFAULT 1,
    bpmn_xml        TEXT          NOT NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DEPLOYED',
    deployed_by     VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_pd_tenant_key_version UNIQUE (tenant_id, process_key, version)
);

CREATE INDEX IF NOT EXISTS idx_wfe_pd_tenant_key ON wfe_process_definition (tenant_id, process_key);
CREATE INDEX IF NOT EXISTS idx_wfe_pd_status ON wfe_process_definition (tenant_id, status);
