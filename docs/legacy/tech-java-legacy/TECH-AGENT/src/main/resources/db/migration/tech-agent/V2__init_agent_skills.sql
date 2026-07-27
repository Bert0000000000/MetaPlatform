-- =============================================================================
-- TECH-AGENT Skills / ScheduledRun / Artifact 数据模型
-- -----------------------------------------------------------------------------
-- P3.3.1 Skill 注册表
-- P3.3.2 ScheduledAgentRun 调度
-- P3.3.4 AgentArtifact 元数据
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_skill (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    skill_code      VARCHAR(128)   NOT NULL,
    display_name    VARCHAR(256)   NOT NULL,
    description     TEXT,
    skill_type      VARCHAR(32)    NOT NULL DEFAULT 'PROMPT',  -- PROMPT / SCRIPT / TOOL_BUNDLE
    content         TEXT           NOT NULL,                    -- Skill 主体（Prompt / Script / YAML）
    tools           TEXT,                                       -- JSON: 该 Skill 暴露的工具列表
    version         INT            NOT NULL DEFAULT 1,
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_skill UNIQUE (tenant_id, skill_code)
);

CREATE TABLE IF NOT EXISTS agent_scheduled_run (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    agent_id        VARCHAR(64)    NOT NULL,
    schedule_kind   VARCHAR(16)    NOT NULL,                    -- ONCE / CRON / INTERVAL
    cron_expression VARCHAR(128),                              -- 标准 cron 表达式（CRON）
    interval_sec    INT,                                        -- 间隔秒（INTERVAL）
    run_at          TIMESTAMP,                                  -- 首次执行（ONCE）
    thread_strategy VARCHAR(32)    NOT NULL DEFAULT 'NEW_THREAD', -- NEW_THREAD / REUSE_THREAD
    overlap_policy  VARCHAR(16)    NOT NULL DEFAULT 'SKIP',     -- SKIP / QUEUE / REPLACE
    input_payload   TEXT,                                       -- JSON: 任务入参
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    last_run_at     TIMESTAMP,
    next_run_at     TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_schedule UNIQUE (tenant_id, agent_id, schedule_kind, cron_expression, interval_sec)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_next ON agent_scheduled_run(next_run_at) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS agent_artifact (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    run_id          VARCHAR(64)    NOT NULL,
    agent_id        VARCHAR(64),
    artifact_kind   VARCHAR(32)    NOT NULL DEFAULT 'FILE',     -- FILE / REPORT / DATASET / CHART
    display_name    VARCHAR(256)   NOT NULL,
    storage_bucket  VARCHAR(128)   NOT NULL,
    storage_key     VARCHAR(512)   NOT NULL,
    mime_type       VARCHAR(64),
    byte_size       BIGINT,
    metadata        TEXT,                                       -- JSON
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_artifact UNIQUE (tenant_id, run_id, artifact_kind, display_name)
);

CREATE INDEX IF NOT EXISTS idx_artifact_run ON agent_artifact(run_id);
CREATE INDEX IF NOT EXISTS idx_artifact_tenant ON agent_artifact(tenant_id, created_at DESC);
