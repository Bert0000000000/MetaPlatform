-- Execution statistics are computed from executions and action_orchestration_execution tables.
-- This migration adds an aggregate stats cache table for performance (P2-ACT-12).
CREATE TABLE action_execution_stats_cache (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             VARCHAR(64) NOT NULL,
    stat_date             DATE NOT NULL,
    action_id             VARCHAR(64),
    total_executions      INT NOT NULL DEFAULT 0,
    successful_executions INT NOT NULL DEFAULT 0,
    failed_executions     INT NOT NULL DEFAULT 0,
    avg_duration_ms       BIGINT NOT NULL DEFAULT 0,
    max_duration_ms       BIGINT NOT NULL DEFAULT 0,
    min_duration_ms       BIGINT NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, stat_date, action_id)
);

CREATE INDEX idx_stats_cache_tenant_date ON action_execution_stats_cache (tenant_id, stat_date);
