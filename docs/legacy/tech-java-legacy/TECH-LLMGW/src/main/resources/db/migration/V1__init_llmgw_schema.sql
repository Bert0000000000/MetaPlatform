-- LLMGW Schema v1.0
-- 模型目录表
CREATE TABLE llmgw_model (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,           -- dashscope/openai/azure
    model_id VARCHAR(100) NOT NULL,          -- qwen-max, gpt-4o 等
    display_name VARCHAR(200) NOT NULL,
    modality VARCHAR(20) NOT NULL DEFAULT 'text', -- text/multimodal/embedding
    context_window INTEGER,
    max_output_tokens INTEGER,
    input_price_per_1k DECIMAL(10,6),
    output_price_per_1k DECIMAL(10,6),
    is_active BOOLEAN NOT NULL DEFAULT true,
    capabilities JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(provider, model_id)
);

-- Prompt 模板表
CREATE TABLE llmgw_prompt (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    template_text TEXT NOT NULL,
    variables JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prompt 版本历史
CREATE TABLE llmgw_prompt_version (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL REFERENCES llmgw_prompt(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    template_text TEXT NOT NULL,
    variables JSONB,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(prompt_id, version)
);

-- 路由规则表
CREATE TABLE llmgw_routing_rule (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    condition_type VARCHAR(50) NOT NULL,     -- model/keyword/task_type/user
    condition_value JSONB NOT NULL,
    target_model VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 限流规则表
CREATE TABLE llmgw_rate_limit_rule (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'user', -- user/app/global
    scope_key VARCHAR(100),
    model_id VARCHAR(100),
    rpm INTEGER NOT NULL DEFAULT 60,           -- requests per minute
    tpm INTEGER,                                -- tokens per minute
    concurrent INTEGER,                         -- concurrent requests
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 配额表
CREATE TABLE llmgw_quota (
    id BIGSERIAL PRIMARY KEY,
    scope VARCHAR(20) NOT NULL DEFAULT 'user', -- user/app
    scope_key VARCHAR(100) NOT NULL,
    model_id VARCHAR(100),
    daily_token_limit BIGINT,
    monthly_token_limit BIGINT,
    daily_request_limit INTEGER,
    monthly_request_limit INTEGER,
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(scope, scope_key, model_id)
);

-- 审计日志表
CREATE TABLE llmgw_audit_log (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64),
    user_id VARCHAR(100),
    app_id VARCHAR(100),
    model_id VARCHAR(100) NOT NULL,
    endpoint VARCHAR(200),
    method VARCHAR(10),
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms BIGINT,
    status_code INTEGER,
    error_message TEXT,
    request_body JSONB,
    response_body JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 成本记录表
CREATE TABLE llmgw_cost_record (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64),
    user_id VARCHAR(100),
    app_id VARCHAR(100),
    model_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
    output_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 代码模板表
CREATE TABLE llmgw_code_template (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    language VARCHAR(50) NOT NULL,           -- java/typescript/python/sql
    template_text TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 代码片段表
CREATE TABLE llmgw_code_snippet (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT REFERENCES llmgw_code_template(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    language VARCHAR(50) NOT NULL,
    code_text TEXT NOT NULL,
    description TEXT,
    tags JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_audit_log_user ON llmgw_audit_log(user_id);
CREATE INDEX idx_audit_log_model ON llmgw_audit_log(model_id);
CREATE INDEX idx_audit_log_created ON llmgw_audit_log(created_at);
CREATE INDEX idx_cost_record_user ON llmgw_cost_record(user_id);
CREATE INDEX idx_cost_record_model ON llmgw_cost_record(model_id);
CREATE INDEX idx_cost_record_date ON llmgw_cost_record(billing_date);
CREATE INDEX idx_rate_limit_scope ON llmgw_rate_limit_rule(scope, scope_key);
