CREATE TABLE ea_capability_concept_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    capability_id   UUID NOT NULL REFERENCES ea_business_capability(id),
    concept_id      VARCHAR(128) NOT NULL,
    concept_code    VARCHAR(128),
    mapping_type    VARCHAR(64) NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, capability_id, concept_id)
);

CREATE INDEX idx_ea_map_cap ON ea_capability_concept_mapping (capability_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_map_concept ON ea_capability_concept_mapping (concept_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_map_tenant ON ea_capability_concept_mapping (tenant_id) WHERE deleted_at IS NULL;
