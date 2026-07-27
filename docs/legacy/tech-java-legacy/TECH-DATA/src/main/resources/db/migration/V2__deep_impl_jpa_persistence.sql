-- TECH-DATA V2 迁移：11 个内存模块的 JPA 持久化表
-- v1.3 Phase 1：从 ConcurrentHashMap 内存存储升级为 PostgreSQL 持久化
-- 涵盖：etl / lakehouse / warehouse / catalog / lineage / quality / monitoring / dbt / queries_history / search

-- ============================================================
-- 1. etl_task — ETL 任务（对应 EtlTaskService 内存对象）
-- ============================================================
CREATE TABLE IF NOT EXISTS etl_task (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     VARCHAR(1024),
    source_ds_id    VARCHAR(64) NOT NULL,
    target_ds_id    VARCHAR(64),
    target_table    VARCHAR(256),
    engine          VARCHAR(32) NOT NULL DEFAULT 'SPRING_BATCH',
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_cron   VARCHAR(64),
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    last_run_id     VARCHAR(64),
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(32),
    rows_processed  BIGINT,
    created_by      VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_etl_task_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT chk_etl_engine CHECK (engine IN ('SPRING_BATCH', 'FLINK', 'AIRFLOW', 'DBT')),
    CONSTRAINT chk_etl_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
CREATE INDEX IF NOT EXISTS idx_etl_task_tenant ON etl_task(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etl_task_status ON etl_task(status);

-- ============================================================
-- 2. etl_task_run — ETL 任务运行历史
-- ============================================================
CREATE TABLE IF NOT EXISTS etl_task_run (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    task_id         VARCHAR(64) NOT NULL,
    status          VARCHAR(32) NOT NULL,
    triggered_by    VARCHAR(64) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    rows_read       BIGINT NOT NULL DEFAULT 0,
    rows_written    BIGINT NOT NULL DEFAULT 0,
    error_message   TEXT,
    execution_log   TEXT,
    CONSTRAINT chk_etl_run_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);
CREATE INDEX IF NOT EXISTS idx_etl_task_run_tenant ON etl_task_run(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etl_task_run_task ON etl_task_run(task_id, started_at DESC);

-- ============================================================
-- 3. lake_table — 数据湖表（对应 LakehouseService）
-- ============================================================
CREATE TABLE IF NOT EXISTS lake_table (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    database_name   VARCHAR(128) NOT NULL,
    table_name      VARCHAR(256) NOT NULL,
    format          VARCHAR(32) NOT NULL DEFAULT 'HUDI',
    description     VARCHAR(1024),
    schema_json     JSONB,
    location        VARCHAR(512),
    properties      JSONB DEFAULT '{}'::jsonb,
    record_count    BIGINT NOT NULL DEFAULT 0,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    last_modified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_lake_table UNIQUE (tenant_id, database_name, table_name, format),
    CONSTRAINT chk_lake_format CHECK (format IN ('HUDI', 'ICEBERG', 'DELTA'))
);
CREATE INDEX IF NOT EXISTS idx_lake_table_tenant ON lake_table(tenant_id);

-- ============================================================
-- 4. ingest_task — 数据摄入任务
-- ============================================================
CREATE TABLE IF NOT EXISTS ingest_task (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    source_ds_id    VARCHAR(64) NOT NULL,
    target_table_id VARCHAR(64) NOT NULL,
    mode            VARCHAR(32) NOT NULL DEFAULT 'BULK',
    cdc_mode        VARCHAR(32),
    schedule_cron   VARCHAR(64),
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(32),
    last_run_rows   BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ingest_mode CHECK (mode IN ('BULK', 'INCREMENTAL', 'CDC')),
    CONSTRAINT chk_ingest_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
CREATE INDEX IF NOT EXISTS idx_ingest_task_tenant ON ingest_task(tenant_id);

-- ============================================================
-- 5. warehouse_table — 数据仓库表（对应 WarehouseService）
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_table (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    layer           VARCHAR(32) NOT NULL,
    database_name   VARCHAR(128) NOT NULL,
    table_name      VARCHAR(256) NOT NULL,
    description     VARCHAR(1024),
    columns_json    JSONB,
    row_count       BIGINT NOT NULL DEFAULT 0,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    last_modified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_warehouse_table UNIQUE (tenant_id, database_name, table_name, layer),
    CONSTRAINT chk_wh_layer CHECK (layer IN ('ODS', 'DWD', 'DWS', 'ADS', 'STAGING', 'DIM'))
);
CREATE INDEX IF NOT EXISTS idx_warehouse_table_tenant ON warehouse_table(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_table_layer ON warehouse_table(tenant_id, layer);

-- ============================================================
-- 6. materialized_view — 物化视图
-- ============================================================
CREATE TABLE IF NOT EXISTS materialized_view (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    base_table      VARCHAR(256) NOT NULL,
    definition      TEXT NOT NULL,
    refresh_strategy VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    last_refreshed_at TIMESTAMPTZ,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mv_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT chk_mv_refresh CHECK (refresh_strategy IN ('MANUAL', 'SCHEDULED', 'AUTO_INCREMENTAL'))
);
CREATE INDEX IF NOT EXISTS idx_mv_tenant ON materialized_view(tenant_id);

-- ============================================================
-- 7. catalog_asset — 数据目录资产（对应 CatalogService）
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_asset (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    type            VARCHAR(32) NOT NULL,
    source          VARCHAR(128) NOT NULL,
    description     TEXT,
    owner           VARCHAR(64),
    tags            JSONB DEFAULT '[]'::jsonb,
    classification  VARCHAR(32) DEFAULT 'INTERNAL',
    schema_json     JSONB,
    profile_json    JSONB,
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_asset_type CHECK (type IN ('TABLE', 'VIEW', 'MATERIALIZED_VIEW', 'FILE', 'API', 'STREAM', 'MODEL')),
    CONSTRAINT chk_asset_class CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'))
);
CREATE INDEX IF NOT EXISTS idx_catalog_asset_tenant ON catalog_asset(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_asset_type ON catalog_asset(tenant_id, type);

-- ============================================================
-- 8. quality_rule — 数据质量规则（对应 QualityService）
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_rule (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    target_asset_id VARCHAR(64) NOT NULL,
    target_column   VARCHAR(128),
    type            VARCHAR(32) NOT NULL,
    severity        VARCHAR(16) NOT NULL DEFAULT 'WARNING',
    expression      TEXT NOT NULL,
    description     VARCHAR(1024),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_qr_type CHECK (type IN ('NOT_NULL', 'UNIQUE', 'RANGE', 'REGEX', 'SQL', 'SCHEMA', 'FRESHNESS', 'COMPLETENESS')),
    CONSTRAINT chk_qr_severity CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'))
);
CREATE INDEX IF NOT EXISTS idx_quality_rule_tenant ON quality_rule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_rule_target ON quality_rule(tenant_id, target_asset_id);

-- ============================================================
-- 9. quality_check — 数据质量检查记录
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_check (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    rule_id         VARCHAR(64) NOT NULL,
    asset_id        VARCHAR(64) NOT NULL,
    status          VARCHAR(16) NOT NULL,
    passed_records  BIGINT NOT NULL DEFAULT 0,
    failed_records  BIGINT NOT NULL DEFAULT 0,
    total_records   BIGINT NOT NULL DEFAULT 0,
    pass_rate       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    error_samples   JSONB DEFAULT '[]'::jsonb,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_qc_status CHECK (status IN ('PASS', 'FAIL', 'ERROR', 'SKIPPED'))
);
CREATE INDEX IF NOT EXISTS idx_quality_check_tenant ON quality_check(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_check_rule ON quality_check(tenant_id, rule_id, checked_at DESC);

-- ============================================================
-- 10. dbt_project — DBT 项目（对应 DbtService）
-- ============================================================
CREATE TABLE IF NOT EXISTS dbt_project (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     VARCHAR(1024),
    target_ds_id    VARCHAR(64) NOT NULL,
    project_path    VARCHAR(512) NOT NULL,
    profiles_path   VARCHAR(512),
    target_name     VARCHAR(64) DEFAULT 'dev',
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dbt_project_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_dbt_project_tenant ON dbt_project(tenant_id);

-- ============================================================
-- 11. dbt_model — DBT 模型
-- ============================================================
CREATE TABLE IF NOT EXISTS dbt_model (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    project_id      VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    materialization VARCHAR(32) NOT NULL DEFAULT 'VIEW',
    sql_content     TEXT,
    description     VARCHAR(1024),
    depends_on      JSONB DEFAULT '[]'::jsonb,
    last_compiled_at TIMESTAMPTZ,
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dbt_mat CHECK (materialization IN ('VIEW', 'TABLE', 'INCREMENTAL', 'EPHEMERAL'))
);
CREATE INDEX IF NOT EXISTS idx_dbt_model_project ON dbt_model(tenant_id, project_id);

-- ============================================================
-- 12. monitoring_alert — 监控告警（对应 MonitoringService）
-- ============================================================
CREATE TABLE IF NOT EXISTS monitoring_alert (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    severity        VARCHAR(16) NOT NULL,
    source          VARCHAR(128) NOT NULL,
    title           VARCHAR(256) NOT NULL,
    description     TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT chk_alert_severity CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    CONSTRAINT chk_alert_status CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED'))
);
CREATE INDEX IF NOT EXISTS idx_alert_tenant ON monitoring_alert(tenant_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_status ON monitoring_alert(tenant_id, status);

-- ============================================================
-- 13. monitoring_log — 监控日志
-- ============================================================
CREATE TABLE IF NOT EXISTS monitoring_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    component       VARCHAR(64) NOT NULL,
    level           VARCHAR(16) NOT NULL,
    message         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_log_level CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR'))
);
CREATE INDEX IF NOT EXISTS idx_log_tenant ON monitoring_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_component ON monitoring_log(tenant_id, component);

-- ============================================================
-- 14. sla_record — SLA 记录
-- ============================================================
CREATE TABLE IF NOT EXISTS sla_record (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    target_type     VARCHAR(32) NOT NULL,
    target_id       VARCHAR(64) NOT NULL,
    metric          VARCHAR(64) NOT NULL,
    threshold       DOUBLE PRECISION NOT NULL,
    actual          DOUBLE PRECISION,
    status          VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    period          VARCHAR(32) NOT NULL,
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sla_status CHECK (status IN ('MET', 'BREACH', 'AT_RISK', 'UNKNOWN'))
);
CREATE INDEX IF NOT EXISTS idx_sla_tenant ON sla_record(tenant_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_target ON sla_record(tenant_id, target_type, target_id);

-- ============================================================
-- 15. query_history — 查询历史（对应 QueryService 的内存 deque）
-- ============================================================
CREATE TABLE IF NOT EXISTS query_history (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    query_id        VARCHAR(64) NOT NULL,
    datasource_id   VARCHAR(64) NOT NULL,
    sql_text        TEXT NOT NULL,
    row_count       INTEGER NOT NULL DEFAULT 0,
    latency_ms      BIGINT NOT NULL DEFAULT 0,
    status          VARCHAR(16) NOT NULL,
    error_message   TEXT,
    executed_by     VARCHAR(64),
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_qh_status CHECK (status IN ('SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'))
);
CREATE INDEX IF NOT EXISTS idx_qh_tenant ON query_history(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_qh_ds ON query_history(tenant_id, datasource_id, executed_at DESC);
CREATE UNIQUE INDEX uq_qh_query_id ON query_history(query_id);

-- ============================================================
-- 16. data_outbox — Kafka Outbox 模式事件表（CLAUDE.md 强约束）
-- ============================================================
CREATE TABLE IF NOT EXISTS data_outbox (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    aggregate_type  VARCHAR(64) NOT NULL,
    aggregate_id    VARCHAR(64) NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    trace_id        VARCHAR(64),
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED'))
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON data_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON data_outbox(tenant_id);

-- ============================================================
-- 17. ALTER data_source — 新增 health_check_at 字段
-- ============================================================
ALTER TABLE data_source ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ;
ALTER TABLE data_source ADD COLUMN IF NOT EXISTS last_health_status VARCHAR(16);
ALTER TABLE data_source ADD COLUMN IF NOT EXISTS last_health_latency_ms BIGINT;

-- ============================================================
-- 18. ALTER deliverable — 新增 object_key 字段（MinIO 对象键）
-- ============================================================
ALTER TABLE deliverable ADD COLUMN IF NOT EXISTS object_key VARCHAR(512);
ALTER TABLE deliverable ADD COLUMN IF NOT EXISTS bucket VARCHAR(128);
