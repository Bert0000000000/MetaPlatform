-- V4__init_agent_run.sql
-- Phase 1 MVP - ERR-3 AgentRun + Task

CREATE TABLE IF NOT EXISTS agent_runs (
    run_id              VARCHAR(64) PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    user_id             VARCHAR(64) NOT NULL,
    agent_id            VARCHAR(128) NOT NULL,
    runtime_type        VARCHAR(32) NOT NULL,
    context_envelope_id VARCHAR(64),
    status              VARCHAR(32) NOT NULL,
    goal                TEXT NOT NULL,
    parent_run_id       VARCHAR(64),
    budget              JSONB NOT NULL,
    trace_id            VARCHAR(64) NOT NULL,
    deerflow_thread_id  VARCHAR(64),
    deerflow_run_id     VARCHAR(64),
    started_at          TIMESTAMP WITH TIME ZONE,
    finished_at         TIMESTAMP WITH TIME ZONE,
    error_code          VARCHAR(64),
    error_message       TEXT,
    revoked_at          TIMESTAMP WITH TIME ZONE,
    revoked_by          VARCHAR(64),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_runtime_type CHECK (runtime_type IN ('DEERFLOW','FAST_QUERY')),
    CONSTRAINT chk_agent_status CHECK (status IN ('PENDING','RUNNING','PAUSED','COMPLETED','FAILED','CANCELED','DEGRADED'))
);

CREATE INDEX idx_agent_runs_tenant_user ON agent_runs(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_agent_runs_trace ON agent_runs(trace_id);
CREATE INDEX idx_agent_runs_envelope ON agent_runs(context_envelope_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status) WHERE status NOT IN ('COMPLETED','FAILED','CANCELED','DEGRADED');

COMMENT ON TABLE agent_runs IS 'Phase 1 AgentRun 主实体（ERR-3）';

CREATE TABLE IF NOT EXISTS tasks (
    task_id        VARCHAR(64) PRIMARY KEY,
    run_id         VARCHAR(64) NOT NULL,
    parent_task_id VARCHAR(64),
    assignee_agent VARCHAR(128) NOT NULL,
    objective      TEXT NOT NULL,
    input          JSONB NOT NULL,
    output_schema  JSONB,
    permissions_ref VARCHAR(64) NOT NULL,
    budget         JSONB NOT NULL,
    status         VARCHAR(32) NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_status CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
    CONSTRAINT fk_tasks_run FOREIGN KEY (run_id) REFERENCES agent_runs(run_id) ON DELETE RESTRICT
);

CREATE INDEX idx_tasks_run ON tasks(run_id);
COMMENT ON TABLE tasks IS 'Phase 1 Task 子实体（ERR-3）';