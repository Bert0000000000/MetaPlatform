-- TECH-A2A 数据库初始化 Schema
-- 对应 Python app/ 下的 8 张核心表

-- 1. agent_card — A2A 协议 Agent Card
CREATE TABLE IF NOT EXISTS agent_card (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    name              VARCHAR(256) NOT NULL,
    description       VARCHAR(2048) DEFAULT '',
    version           VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    protocol_version  VARCHAR(16) NOT NULL DEFAULT '0.3.0',
    capabilities      JSONB NOT NULL DEFAULT '[]'::jsonb,
    endpoints         JSONB NOT NULL DEFAULT '{}'::jsonb,
    authentication    JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata          JSONB,
    status            VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_a2a_card_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_a2a_card_tenant ON agent_card(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_card_status ON agent_card(status);

-- 2. agent_registration — Agent 注册表
CREATE TABLE IF NOT EXISTS agent_registration (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    agent_id          VARCHAR(128) NOT NULL,
    name              VARCHAR(256) NOT NULL,
    description       VARCHAR(2048) DEFAULT '',
    endpoints         JSONB NOT NULL DEFAULT '[]'::jsonb,
    capabilities      JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    last_heartbeat    TIMESTAMPTZ,
    registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_a2a_reg_tenant_agent UNIQUE (tenant_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_a2a_reg_tenant ON agent_registration(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_reg_status ON agent_registration(status);

-- 3. delegated_task — A2A 委派任务
CREATE TABLE IF NOT EXISTS delegated_task (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    source_agent_id   VARCHAR(128) NOT NULL,
    target_agent_id   VARCHAR(128) NOT NULL,
    task_type         VARCHAR(64) NOT NULL DEFAULT 'generic',
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    result            JSONB,
    error             VARCHAR(2048),
    trace_id          VARCHAR(64),
    timeout           DOUBLE PRECISION,
    callback_url      VARCHAR(1024),
    status_history    JSONB NOT NULL DEFAULT '[]'::jsonb,
    artifacts         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_a2a_task_tenant ON delegated_task(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_task_source ON delegated_task(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_task_target ON delegated_task(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_task_status ON delegated_task(status);

-- 4. inbound_task — 入站 JSON-RPC 任务
CREATE TABLE IF NOT EXISTS inbound_task (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    source_agent_id   VARCHAR(128) NOT NULL,
    target_agent_id   VARCHAR(128) NOT NULL,
    task_type         VARCHAR(64) NOT NULL DEFAULT 'generic',
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    result            JSONB,
    error             VARCHAR(2048),
    trace_id          VARCHAR(64),
    jsonrpc_id        VARCHAR(64),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_a2a_inb_tenant ON inbound_task(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_inb_source ON inbound_task(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_inb_status ON inbound_task(status);

-- 5. agent_message — Agent 间消息
CREATE TABLE IF NOT EXISTS agent_message (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    from_agent_id     VARCHAR(128) NOT NULL,
    to_agent_id       VARCHAR(128) NOT NULL,
    message_type      VARCHAR(32) NOT NULL DEFAULT 'text',
    content           JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    acknowledged_at   TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_a2a_msg_tenant ON agent_message(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_msg_to ON agent_message(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_msg_status ON agent_message(status);
CREATE INDEX IF NOT EXISTS idx_a2a_msg_expires ON agent_message(expires_at);

-- 6. audit_record — A2A 操作审计记录
CREATE TABLE IF NOT EXISTS audit_record (
    id                VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    action            VARCHAR(64) NOT NULL,
    actor_id          VARCHAR(128) DEFAULT '',
    target_id         VARCHAR(128) DEFAULT '',
    details           JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id          VARCHAR(64),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_a2a_aud_tenant ON audit_record(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_aud_action ON audit_record(action);
CREATE INDEX IF NOT EXISTS idx_a2a_aud_actor ON audit_record(actor_id);

-- 7. api_key — Agent API Key
CREATE TABLE IF NOT EXISTS api_key (
    key_id            VARCHAR(64) PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL,
    agent_id          VARCHAR(128) NOT NULL,
    key_hash          VARCHAR(128) NOT NULL,
    permissions       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked           BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_a2a_key_tenant ON api_key(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a2a_key_agent ON api_key(agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_key_hash ON api_key(key_hash);
CREATE INDEX IF NOT EXISTS idx_a2a_key_revoked ON api_key(revoked);

-- 8. outbox_event — Outbox 事件表（待 Kafka 中继）
CREATE TABLE IF NOT EXISTS outbox_event (
    event_id          VARCHAR(64) PRIMARY KEY,
    event_type        VARCHAR(64) NOT NULL,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id          VARCHAR(64),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    relayed           BOOLEAN NOT NULL DEFAULT false,
    relayed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_a2a_evt_relayed ON outbox_event(relayed);
CREATE INDEX IF NOT EXISTS idx_a2a_evt_type ON outbox_event(event_type);
