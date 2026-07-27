-- =============================================================================
-- V9: P1.1.3 Ontology Metric Schema
-- -----------------------------------------------------------------------------
-- 语义指标：用于 DeerFlow / Agent / SuperAI 在 Ontology Context 中调用业务指标。
-- 计算 DSL 以 SQL 片段方式存储（由 Service 层执行），formula 与 dimension 可选。
-- 租户隔离；与 Concept 弱耦合（metric.conceptCode 字符串即可）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS ont_metric (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    metric_code     VARCHAR(128)   NOT NULL,
    concept_code    VARCHAR(64)    NOT NULL,
    display_name    VARCHAR(256)   NOT NULL,
    description     TEXT,
    formula_sql     TEXT           NOT NULL,    -- 计算 SQL 片段，含 :tenantId / :conceptCode 占位符
    return_type     VARCHAR(32)    NOT NULL DEFAULT 'DECIMAL', -- DECIMAL/INT/BOOLEAN/JSON
    unit            VARCHAR(32),                  -- % / count / ms 等
    dimensions      TEXT,                          -- JSON 数组 ["region","customerLevel"]
    aggregation     VARCHAR(16)    NOT NULL DEFAULT 'SUM', -- SUM/AVG/COUNT/MIN/MAX
    cache_ttl_sec   INT            NOT NULL DEFAULT 60,
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    version         INT            NOT NULL DEFAULT 1,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_metric UNIQUE (tenant_id, metric_code)
);

CREATE INDEX IF NOT EXISTS idx_metric_concept ON ont_metric(tenant_id, concept_code, enabled);
CREATE INDEX IF NOT EXISTS idx_metric_enabled ON ont_metric(tenant_id, enabled);

COMMENT ON TABLE  ont_metric IS 'Ontology 语义指标：用于 Agent / DeerFlow 在 Context 中查询业务度量';
COMMENT ON COLUMN ont_metric.formula_sql IS '计算 SQL 片段，支持 :tenantId/:conceptCode/:objectId 占位符';
