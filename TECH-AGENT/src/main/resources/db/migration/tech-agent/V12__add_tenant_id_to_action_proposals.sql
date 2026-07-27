-- V12__add_tenant_id_to_action_proposals.sql
-- P5.12 cross-tenant dedup support.
ALTER TABLE action_proposals ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_action_proposals_tenant_dedup
    ON action_proposals(tenant_id, run_id, action_code, target_objects)
    WHERE decided_at IS NULL;

