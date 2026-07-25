-- TECH-DATA V3 迁移：数据映射（外部字段 → Ontology 实体属性）
-- PRD REQ-3.2.2：数据映射 CRUD + 字段映射管理 + 映射执行 + 自动发现

-- ============================================================
-- 1. data_mapping — 数据映射主表
-- ============================================================
CREATE TABLE IF NOT EXISTS data_mapping (
    id                  VARCHAR(64) PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    name                VARCHAR(128) NOT NULL,
    description         VARCHAR(1024),
    datasource_id       VARCHAR(64) NOT NULL,
    source_table        VARCHAR(256) NOT NULL,
    ontology_entity_id  VARCHAR(64) NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    sync_mode           VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    cron_expression     VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_data_mapping_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT chk_mapping_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
    CONSTRAINT chk_mapping_sync_mode CHECK (sync_mode IN ('MANUAL', 'SCHEDULED', 'REALTIME'))
);
CREATE INDEX IF NOT EXISTS idx_data_mapping_tenant ON data_mapping(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_mapping_datasource ON data_mapping(tenant_id, datasource_id);
CREATE INDEX IF NOT EXISTS idx_data_mapping_ontology ON data_mapping(tenant_id, ontology_entity_id);
CREATE INDEX IF NOT EXISTS idx_data_mapping_status ON data_mapping(tenant_id, status);

-- ============================================================
-- 2. data_mapping_field — 字段映射（外部字段 → Ontology 属性）
-- ============================================================
CREATE TABLE IF NOT EXISTS data_mapping_field (
    id                      VARCHAR(64) PRIMARY KEY,
    tenant_id               VARCHAR(64) NOT NULL,
    mapping_id              VARCHAR(64) NOT NULL,
    source_field            VARCHAR(256) NOT NULL,
    source_type             VARCHAR(64) NOT NULL,
    ontology_attribute      VARCHAR(256) NOT NULL,
    target_type             VARCHAR(64) NOT NULL,
    transform_expression    VARCHAR(1024),
    is_required             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mapping_field_tenant ON data_mapping_field(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapping_field_mapping ON data_mapping_field(tenant_id, mapping_id, created_at);

-- ============================================================
-- 3. data_mapping_execution — 映射执行记录（同步日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS data_mapping_execution (
    id                  VARCHAR(64) PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    mapping_id          VARCHAR(64) NOT NULL,
    status              VARCHAR(16) NOT NULL,
    records_processed   BIGINT NOT NULL DEFAULT 0,
    records_failed      BIGINT NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ NOT NULL,
    finished_at         TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_mapping_exec_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'ABORTED'))
);
CREATE INDEX IF NOT EXISTS idx_mapping_exec_tenant ON data_mapping_execution(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapping_exec_mapping ON data_mapping_execution(tenant_id, mapping_id, started_at DESC);
