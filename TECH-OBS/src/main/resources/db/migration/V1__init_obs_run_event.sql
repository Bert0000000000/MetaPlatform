-- =============================================================================
-- TECH-OBS V1: 全链路 RunEvent（P8.2）
-- =============================================================================

CREATE TABLE IF NOT EXISTS obs_run_event (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    run_id          VARCHAR(64)    NOT NULL,
    task_id         VARCHAR(64),
    agent_id        VARCHAR(64),
    type            VARCHAR(64)    NOT NULL,
    payload         TEXT,
    ts              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trace_id        VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_event_run ON obs_run_event(run_id, ts);
CREATE INDEX IF NOT EXISTS idx_event_tenant_type ON obs_run_event(tenant_id, type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_event_trace ON obs_run_event(trace_id);

COMMENT ON TABLE obs_run_event IS '全链路 RunEvent 仓：Agent / Ontology / Document / Action 事件统一存储';
