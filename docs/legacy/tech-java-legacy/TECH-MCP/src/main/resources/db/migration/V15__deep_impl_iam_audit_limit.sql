-- TECH-MCP V15 迁移：IAM 鉴权 + 审计 + 限流基础设施
-- v1.3 Phase 1：补齐生产化能力所需的表结构

-- ============================================================
-- 1. mcp_outbox — Kafka Outbox 模式事件表（CLAUDE.md 强约束）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_outbox (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    aggregate_type  VARCHAR(64) NOT NULL,
    aggregate_id    VARCHAR(64) NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    trace_id        VARCHAR(64),
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    last_error      TEXT,
    CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED'))
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON mcp_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON mcp_outbox(tenant_id);

-- ============================================================
-- 2. mcp_api_key — MCP 平台 API Key（IAM 签发）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_api_key (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    key_id          VARCHAR(64) NOT NULL,
    key_hash        VARCHAR(256) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    scopes          JSONB DEFAULT '[]'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_by      VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mcp_api_key_key_id UNIQUE (key_id)
);
CREATE INDEX IF NOT EXISTS idx_mcp_api_key_tenant ON mcp_api_key(tenant_id);

-- ============================================================
-- 3. mcp_rate_limit — Tool 并发限流（Redis 兜底：本地计数）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_rate_limit (
    id              VARCHAR(128) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    tool_id         VARCHAR(64) NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    call_count      INTEGER NOT NULL DEFAULT 0,
    rejected_count  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_mcp_rate_limit UNIQUE (tenant_id, tool_id, window_start)
);
CREATE INDEX IF NOT EXISTS idx_mcp_rate_limit_window ON mcp_rate_limit(window_start);

-- ============================================================
-- 4. mcp_health_check — 连接健康检查记录
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_health_check (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    target_type     VARCHAR(16) NOT NULL,  -- SERVER / CLIENT
    target_id       VARCHAR(64) NOT NULL,
    status          VARCHAR(16) NOT NULL,  -- UP / DOWN / DEGRADED
    latency_ms      BIGINT,
    error_message   TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_health_target ON mcp_health_check(tenant_id, target_type, target_id, checked_at DESC);