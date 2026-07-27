-- V3: 关系类型与关系实例（P1-ONT-01 / P1-ONT-02）
-- Phase 2 Sprint 1：建立关系建模基础表

CREATE TABLE IF NOT EXISTS ont_relation_type (
    relation_type_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(128) NOT NULL,
    description TEXT,
    source_concept_id VARCHAR(64) NOT NULL,
    target_concept_id VARCHAR(64) NOT NULL,
    direction VARCHAR(32) NOT NULL DEFAULT 'DIRECTED',
    cardinality VARCHAR(32) NOT NULL DEFAULT 'MANY_TO_MANY',
    min_cardinality INTEGER NOT NULL DEFAULT 0,
    max_cardinality INTEGER NOT NULL DEFAULT 0,
    symmetric_flag BOOLEAN NOT NULL DEFAULT FALSE,
    transitive BOOLEAN NOT NULL DEFAULT FALSE,
    inverse_relation_type_id VARCHAR(64),
    attribute_ids JSONB,
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_relation_type_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ont_relation_type_tenant ON ont_relation_type(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ont_relation_type_source_concept ON ont_relation_type(source_concept_id);
CREATE INDEX IF NOT EXISTS idx_ont_relation_type_target_concept ON ont_relation_type(target_concept_id);

CREATE TABLE IF NOT EXISTS ont_relation_instance (
    relation_instance_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    relation_type_id VARCHAR(64) NOT NULL,
    source_entity_id VARCHAR(64) NOT NULL,
    target_entity_id VARCHAR(64) NOT NULL,
    attributes JSONB,
    metadata JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ont_relation_instance_tenant ON ont_relation_instance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ont_relation_instance_type ON ont_relation_instance(relation_type_id);
CREATE INDEX IF NOT EXISTS idx_ont_relation_instance_source ON ont_relation_instance(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_ont_relation_instance_target ON ont_relation_instance(target_entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_ont_relation_instance_triplet
    ON ont_relation_instance(tenant_id, relation_type_id, source_entity_id, target_entity_id);