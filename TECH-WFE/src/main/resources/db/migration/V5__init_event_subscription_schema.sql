-- ════════════════════════════════════════════════════════════
-- TECH-WFE V5: P1-WFE-10 事件订阅表
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_event_subscription (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    user_id         VARCHAR(64)   NOT NULL,
    event_types     JSONB         NOT NULL DEFAULT '[]'::jsonb,
    callback_url    VARCHAR(2048) NOT NULL,
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_sub_tenant_user ON wfe_event_subscription (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_wfe_sub_enabled ON wfe_event_subscription (tenant_id, enabled);