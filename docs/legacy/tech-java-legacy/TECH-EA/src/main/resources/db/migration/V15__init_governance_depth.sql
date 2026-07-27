-- V15: V13-10 APP-ARCH 架构治理深度（原则分类 / 评审模板 / 评审工单 / 技术债务分级与清偿计划）

-- 原则分类体系
CREATE TABLE ea_principle_category (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    parent_id   UUID,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_pc_tenant ON ea_principle_category (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_pc_parent ON ea_principle_category (parent_id) WHERE deleted_at IS NULL;

-- 架构原则条目
CREATE TABLE ea_architecture_principle (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    category_id UUID,
    description TEXT,
    priority    VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status      VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    standards   JSONB DEFAULT '[]'::jsonb,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_eap_category FOREIGN KEY (category_id) REFERENCES ea_principle_category (id)
);

CREATE INDEX idx_ea_ap_tenant ON ea_architecture_principle (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_ap_category ON ea_architecture_principle (category_id) WHERE deleted_at IS NULL;

-- 评审模板
CREATE TABLE ea_review_template (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(128) NOT NULL,
    description TEXT,
    dimensions  JSONB DEFAULT '[]'::jsonb,
    experts     JSONB DEFAULT '[]'::jsonb,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_ea_rt_tenant ON ea_review_template (tenant_id) WHERE deleted_at IS NULL;

-- 评审工单
CREATE TABLE ea_review_ticket (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'tenant-default',
    title       VARCHAR(256) NOT NULL,
    template_id UUID,
    target_type VARCHAR(64),
    target_id   UUID,
    applicant   VARCHAR(128),
    reviewer    VARCHAR(128),
    status      VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    scores      JSONB DEFAULT '[]'::jsonb,
    comments    JSONB DEFAULT '[]'::jsonb,
    decision    TEXT,
    submitted_at TIMESTAMPTZ,
    decided_at  TIMESTAMPTZ,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT fk_ert_template FOREIGN KEY (template_id) REFERENCES ea_review_template (id)
);

CREATE INDEX idx_ea_rticket_tenant ON ea_review_ticket (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ea_rticket_status ON ea_review_ticket (tenant_id, status) WHERE deleted_at IS NULL;

-- 技术债务分级与清偿计划扩展
ALTER TABLE ea_tech_debt ADD COLUMN IF NOT EXISTS debt_level VARCHAR(32) DEFAULT 'GENERAL';
ALTER TABLE ea_tech_debt ADD COLUMN IF NOT EXISTS repayment_plan JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_ea_td_level ON ea_tech_debt (tenant_id, debt_level) WHERE deleted_at IS NULL;
