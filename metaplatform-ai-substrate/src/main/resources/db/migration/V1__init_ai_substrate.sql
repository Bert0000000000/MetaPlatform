-- Token usage table
CREATE TABLE token_usage (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    model VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_usage_tenant_date ON token_usage(tenant_id, usage_date);
CREATE INDEX idx_token_usage_model ON token_usage(tenant_id, model);
