-- TECH-AGENT 数据库初始化 Schema
-- 对应 Python app/ 下的 13 张 ORM 表

-- 1. agent_definition — Agent 主定义
CREATE TABLE IF NOT EXISTS agent_definition (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    agent_code      VARCHAR(128) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     VARCHAR(1024),
    model_id        VARCHAR(256) NOT NULL,
    system_prompt   VARCHAR(8192) NOT NULL,
    tools           JSONB NOT NULL DEFAULT '[]'::jsonb,
    rag_scopes      JSONB NOT NULL DEFAULT '[]'::jsonb,
    temperature     VARCHAR(16) NOT NULL DEFAULT '0.7',
    max_tokens      VARCHAR(16) NOT NULL DEFAULT '4096',
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_tenant_code UNIQUE (tenant_id, agent_code)
);
CREATE INDEX IF NOT EXISTS idx_agent_def_tenant ON agent_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_def_deleted ON agent_definition(deleted_at);

-- 2. agent_version — Agent 版本快照
CREATE TABLE IF NOT EXISTS agent_version (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    agent_id    VARCHAR(64) NOT NULL,
    version     VARCHAR(32) NOT NULL,
    change_log  VARCHAR(1024) NOT NULL DEFAULT '',
    snapshot    JSONB,
    created_by  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_ver_tenant ON agent_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_ver_agent ON agent_version(agent_id);

-- 3. agent_operation_log — 操作审计日志
CREATE TABLE IF NOT EXISTS agent_operation_log (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    agent_id    VARCHAR(64) NOT NULL,
    actor       VARCHAR(64) NOT NULL DEFAULT 'system',
    action      VARCHAR(64) NOT NULL,
    resource    VARCHAR(128) NOT NULL DEFAULT 'agent',
    ip          VARCHAR(64),
    status      VARCHAR(16) NOT NULL DEFAULT 'success',
    trace_id    VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_oplog_tenant ON agent_operation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_oplog_agent ON agent_operation_log(agent_id);

-- 4. agent_checkpoints — 执行检查点
CREATE TABLE IF NOT EXISTS agent_checkpoints (
    checkpoint_id    VARCHAR(64) PRIMARY KEY,
    execution_id     VARCHAR(64) NOT NULL,
    tenant_id        VARCHAR(64) NOT NULL,
    agent_id         VARCHAR(64) NOT NULL,
    state            JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_ckpt_exec ON agent_checkpoints(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_ckpt_tenant ON agent_checkpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_ckpt_agent ON agent_checkpoints(agent_id);

-- 5. agent_conversations — 对话
CREATE TABLE IF NOT EXISTS agent_conversations (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    agent_id        VARCHAR(64) NOT NULL,
    title           VARCHAR(512) DEFAULT '',
    status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    message_count   INTEGER NOT NULL DEFAULT 0,
    favorite        BOOLEAN NOT NULL DEFAULT false,
    mode            VARCHAR(32) NOT NULL DEFAULT 'chat',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_conv_tenant ON agent_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_agent ON agent_conversations(agent_id);

-- 6. agent_messages — 消息
CREATE TABLE IF NOT EXISTS agent_messages (
    id              VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL,
    role            VARCHAR(32) NOT NULL,
    content         VARCHAR(16384) NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_msg_conv ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_msg_tenant ON agent_messages(tenant_id);

-- 7. agent_memory_sessions — 记忆会话
CREATE TABLE IF NOT EXISTS agent_memory_sessions (
    session_id      VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    agent_id        VARCHAR(64) NOT NULL,
    title           VARCHAR(512) DEFAULT '',
    message_count   INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_mem_sess_tenant ON agent_memory_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_mem_sess_agent ON agent_memory_sessions(agent_id);

-- 8. agent_memory_messages — 记忆消息
CREATE TABLE IF NOT EXISTS agent_memory_messages (
    id          VARCHAR(64) PRIMARY KEY,
    session_id  VARCHAR(64) NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    agent_id    VARCHAR(64) NOT NULL,
    role        VARCHAR(32) NOT NULL,
    content     VARCHAR(16384) NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_mem_msg_session ON agent_memory_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_mem_msg_tenant ON agent_memory_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_mem_msg_agent ON agent_memory_messages(agent_id);

-- 9. agent_steps — 执行步骤
CREATE TABLE IF NOT EXISTS agent_steps (
    id          VARCHAR(64) PRIMARY KEY,
    execution_id VARCHAR(64) NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    step_type   VARCHAR(32) NOT NULL,
    content     VARCHAR(16384) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_step_exec ON agent_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_step_tenant ON agent_steps(tenant_id);

-- 10. agent_tool_calls — 工具调用记录
CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id          VARCHAR(64) PRIMARY KEY,
    execution_id VARCHAR(64) NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    tool_name   VARCHAR(256) NOT NULL,
    tool_input  JSONB,
    tool_output JSONB,
    status      VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_tc_exec ON agent_tool_calls(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_tc_tenant ON agent_tool_calls(tenant_id);

-- 11. agent_evaluations — 执行评估
CREATE TABLE IF NOT EXISTS agent_evaluations (
    id          VARCHAR(64) PRIMARY KEY,
    execution_id VARCHAR(64) NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    score       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    feedback    VARCHAR(2048) DEFAULT '',
    evaluator   VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_eval_exec ON agent_evaluations(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_eval_tenant ON agent_evaluations(tenant_id);

-- 12. agent_tasks — 任务
CREATE TABLE IF NOT EXISTS agent_tasks (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    agent_id    VARCHAR(64) NOT NULL,
    title       VARCHAR(512) NOT NULL,
    description VARCHAR(2048),
    status      VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    priority    VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    assigned_to VARCHAR(128),
    input       JSONB,
    output      JSONB,
    error_message VARCHAR(2048),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_task_tenant ON agent_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_agent ON agent_tasks(agent_id);

-- 13. agent_tools — 工具定义
CREATE TABLE IF NOT EXISTS agent_tools (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    agent_id    VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    description VARCHAR(1024),
    tool_type   VARCHAR(32) NOT NULL DEFAULT 'ACTION',
    config      JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_schema JSONB,
    output_schema JSONB,
    enabled     VARCHAR(8) NOT NULL DEFAULT 'true',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_tool_tenant ON agent_tools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_agent ON agent_tools(agent_id);
