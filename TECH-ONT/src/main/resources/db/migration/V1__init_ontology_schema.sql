CREATE TABLE IF NOT EXISTS ont_concepts (
    concept_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(128) NOT NULL,
    description TEXT,
    parent_concept_id VARCHAR(64),
    icon VARCHAR(64),
    metadata JSONB,
    depth INTEGER NOT NULL DEFAULT 0,
    path VARCHAR(1024),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_concepts_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uk_ont_concepts_tenant_name_parent UNIQUE (tenant_id, name, parent_concept_id)
);

CREATE INDEX IF NOT EXISTS idx_ont_concepts_parent ON ont_concepts(parent_concept_id);
CREATE INDEX IF NOT EXISTS idx_ont_concepts_tenant ON ont_concepts(tenant_id);

CREATE TABLE IF NOT EXISTS ont_attributes (
    attribute_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(128) NOT NULL,
    description TEXT,
    data_type VARCHAR(32) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    unique_value BOOLEAN NOT NULL DEFAULT FALSE,
    default_value JSONB,
    enum_values JSONB,
    constraints JSONB,
    unit VARCHAR(32),
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_attributes_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ont_attributes_tenant ON ont_attributes(tenant_id);

CREATE TABLE IF NOT EXISTS ont_concept_attributes (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    attribute_id VARCHAR(64) NOT NULL,
    inherited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_concept_attributes UNIQUE (concept_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_ont_concept_attributes_concept ON ont_concept_attributes(concept_id);
CREATE INDEX IF NOT EXISTS idx_ont_concept_attributes_attribute ON ont_concept_attributes(attribute_id);

CREATE TABLE IF NOT EXISTS ont_entities (
    entity_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    code VARCHAR(128),
    description TEXT,
    metadata JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_entities_tenant_concept_code UNIQUE (tenant_id, concept_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ont_entities_concept ON ont_entities(concept_id);
CREATE INDEX IF NOT EXISTS idx_ont_entities_tenant ON ont_entities(tenant_id);

CREATE TABLE IF NOT EXISTS ont_entity_attribute (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    attribute_id VARCHAR(64) NOT NULL,
    value JSONB,
    valid BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ont_entity_attribute UNIQUE (entity_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_ont_entity_attribute_entity ON ont_entity_attribute(entity_id);
CREATE INDEX IF NOT EXISTS idx_ont_entity_attribute_attribute ON ont_entity_attribute(attribute_id);
CREATE INDEX IF NOT EXISTS idx_ont_entity_attribute_value ON ont_entity_attribute USING GIN (value);
