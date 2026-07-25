-- ════════════════════════════════════════════════════════════
-- TECH-WFE V9: 自研状态机引擎表结构
--   替代 Flowable ACT_RU_TASK / ACT_HI_TASKINST / ACT_HI_ACTINST / ACT_HI_COMMENT / ACT_RU_VARIABLE
--   - wfe_task：运行时任务（替代 ACT_RU_TASK）
--   - wfe_task_history：任务操作历史（替代 ACT_HI_TASKINST）
--   - wfe_activity_log：节点活动日志（替代 ACT_HI_ACTINST）
--   - wfe_task_comment：任务评论（替代 ACT_HI_COMMENT）
--   - wfe_process_variable：流程变量（替代 ACT_RU_VARIABLE）
--   同时扩展 wfe_process_definition 增加 flowgram_json 字段
-- ════════════════════════════════════════════════════════════

-- 扩展流程定义表：新增 FlowGram.AI fixed-layout JSON 字段
ALTER TABLE wfe_process_definition ADD COLUMN IF NOT EXISTS flowgram_json TEXT;

-- 运行时任务表（替代 ACT_RU_TASK）
CREATE TABLE IF NOT EXISTS wfe_task (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    process_instance_id     VARCHAR(64)   NOT NULL,
    process_definition_id   VARCHAR(64),
    node_id                 VARCHAR(128)  NOT NULL,
    node_name               VARCHAR(256)  NOT NULL,
    assignee                VARCHAR(64),
    status                  VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE',
    action                  VARCHAR(32),
    form_data               TEXT,
    due_date                TIMESTAMPTZ,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_task_tenant_assignee ON wfe_task (tenant_id, assignee);
CREATE INDEX IF NOT EXISTS idx_wfe_task_process_instance ON wfe_task (process_instance_id);
CREATE INDEX IF NOT EXISTS idx_wfe_task_tenant_status ON wfe_task (tenant_id, status);

-- 任务操作历史表（替代 ACT_HI_TASKINST）
CREATE TABLE IF NOT EXISTS wfe_task_history (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    task_id                 VARCHAR(64)   NOT NULL,
    process_instance_id     VARCHAR(64)   NOT NULL,
    node_id                 VARCHAR(128),
    name                    VARCHAR(256),
    assignee                VARCHAR(64),
    action                  VARCHAR(32)   NOT NULL,
    operator                VARCHAR(64),
    comment                 VARCHAR(2048),
    form_data               TEXT,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_task_history_tenant_task ON wfe_task_history (tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_wfe_task_history_tenant_assignee ON wfe_task_history (tenant_id, assignee);
CREATE INDEX IF NOT EXISTS idx_wfe_task_history_process_instance ON wfe_task_history (process_instance_id);

-- 节点活动日志表（替代 ACT_HI_ACTINST）
CREATE TABLE IF NOT EXISTS wfe_activity_log (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    process_instance_id     VARCHAR(64)   NOT NULL,
    task_id                 VARCHAR(64),
    node_id                 VARCHAR(128)  NOT NULL,
    node_type               VARCHAR(64)   NOT NULL,
    activity_type           VARCHAR(64),
    assignee                VARCHAR(64),
    entered_at              TIMESTAMPTZ   NOT NULL,
    exited_at               TIMESTAMPTZ,
    metadata                TEXT
);

CREATE INDEX IF NOT EXISTS idx_wfe_activity_log_process_instance ON wfe_activity_log (process_instance_id);
CREATE INDEX IF NOT EXISTS idx_wfe_activity_log_tenant_process ON wfe_activity_log (tenant_id, process_instance_id);
CREATE INDEX IF NOT EXISTS idx_wfe_activity_log_task ON wfe_activity_log (task_id);

-- 任务评论表（替代 ACT_HI_COMMENT）
CREATE TABLE IF NOT EXISTS wfe_task_comment (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    task_id                 VARCHAR(64)   NOT NULL,
    process_instance_id     VARCHAR(64)   NOT NULL,
    user_id                 VARCHAR(64)   NOT NULL,
    content                 VARCHAR(2048) NOT NULL,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfe_task_comment_tenant_task ON wfe_task_comment (tenant_id, task_id);
CREATE INDEX IF NOT EXISTS idx_wfe_task_comment_process_instance ON wfe_task_comment (process_instance_id);

-- 流程变量表（替代 ACT_RU_VARIABLE）
CREATE TABLE IF NOT EXISTS wfe_process_variable (
    id                      VARCHAR(64)   PRIMARY KEY,
    tenant_id               VARCHAR(64)   NOT NULL,
    process_instance_id     VARCHAR(64)   NOT NULL,
    name                    VARCHAR(128)  NOT NULL,
    type                    VARCHAR(32)   NOT NULL DEFAULT 'string',
    value                   TEXT,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_pv_instance_name UNIQUE (process_instance_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wfe_process_variable_process_instance ON wfe_process_variable (process_instance_id);
