CREATE TABLE ea_ontology_mapping_rule (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    asset_type      VARCHAR(64) NOT NULL,
    asset_id        UUID NOT NULL,
    asset_name      VARCHAR(256),
    concept_id      VARCHAR(128) NOT NULL,
    concept_code    VARCHAR(128),
    mapping_type    VARCHAR(64) NOT NULL,
    description     VARCHAR(1024),
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, asset_type, asset_id, concept_id)
);

CREATE INDEX idx_ont_rule_asset ON ea_ontology_mapping_rule (asset_type, asset_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ont_rule_concept ON ea_ontology_mapping_rule (concept_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ont_rule_tenant ON ea_ontology_mapping_rule (tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE ea_ontology_change_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    concept_id      VARCHAR(128) NOT NULL,
    concept_code    VARCHAR(128),
    concept_name    VARCHAR(256),
    change_type     VARCHAR(64) NOT NULL,
    rule_id         UUID REFERENCES ea_ontology_mapping_rule(id),
    asset_type      VARCHAR(64),
    asset_id        UUID,
    status          VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    review_ticket_id UUID,
    payload         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ont_change_concept ON ea_ontology_change_event (concept_id) WHERE status = 'PENDING';
CREATE INDEX idx_ont_change_status ON ea_ontology_change_event (tenant_id, status);
CREATE INDEX idx_ont_change_ticket ON ea_ontology_change_event (review_ticket_id);
