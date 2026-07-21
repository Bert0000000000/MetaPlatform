-- V17: V14-08 APP-ARCH 业务架构补全
-- 扩展价值流、业务流程、业务角色表，支持阶段能力/角色关联、流程 BPMN/应用系统/角色关联、角色组织/业务域/IAM 映射

-- 1. 价值流扩展触发事件与终止事件
ALTER TABLE ea_value_stream
    ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(256),
    ADD COLUMN IF NOT EXISTS termination_event VARCHAR(256);

-- 2. 价值流阶段扩展关联能力、产出物、参与角色
ALTER TABLE ea_value_stream_stage
    ADD COLUMN IF NOT EXISTS capability_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS outputs JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS participant_role_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ea_vss_caps ON ea_value_stream_stage USING GIN (capability_ids);

-- 3. 业务流程扩展类型、频率、涉及系统、BPMN XML、负责角色
ALTER TABLE ea_business_process
    ADD COLUMN IF NOT EXISTS process_type VARCHAR(32) DEFAULT 'MAIN',
    ADD COLUMN IF NOT EXISTS frequency VARCHAR(32) DEFAULT 'DAILY',
    ADD COLUMN IF NOT EXISTS application_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS responsible_role_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS bpmn_xml TEXT;

CREATE INDEX IF NOT EXISTS idx_ea_bp_apps ON ea_business_process USING GIN (application_ids);
CREATE INDEX IF NOT EXISTS idx_ea_bp_roles ON ea_business_process USING GIN (responsible_role_ids);

-- 4. 业务角色扩展组织单元、业务域、IAM 角色映射
ALTER TABLE ea_business_role
    ADD COLUMN IF NOT EXISTS org_unit_id UUID,
    ADD COLUMN IF NOT EXISTS domain VARCHAR(64),
    ADD COLUMN IF NOT EXISTS iam_role_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ea_role_org ON ea_business_role (org_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ea_role_domain ON ea_business_role (tenant_id, domain) WHERE deleted_at IS NULL;

-- 5. 业务流程-角色关联表（支持三向关联与流程数统计）
CREATE TABLE IF NOT EXISTS ea_business_process_role (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    process_id    UUID NOT NULL REFERENCES ea_business_process(id) ON DELETE CASCADE,
    role_id       UUID NOT NULL REFERENCES ea_business_role(id) ON DELETE CASCADE,
    relationship  VARCHAR(64) NOT NULL DEFAULT 'RESPONSIBLE',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, process_id, role_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_ea_bpr_process ON ea_business_process_role (process_id);
CREATE INDEX IF NOT EXISTS idx_ea_bpr_role ON ea_business_process_role (role_id);
