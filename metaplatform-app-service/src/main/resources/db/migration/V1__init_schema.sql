-- ============================================================================
-- v1.0.1 Sprint 0 (Java 重写版) — metaplatform-app-service 初始化迁移
-- 文件：V1__init_schema.sql
-- 数据库：PostgreSQL 16
-- 与 ontology-engine 同栈，metadata 与 shared-style schema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- apps: 应用主表
-- ----------------------------------------------------------------------------
CREATE TABLE apps (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL,
    code         VARCHAR(64) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    icon         VARCHAR(64),
    description  TEXT,
    version      INTEGER NOT NULL DEFAULT 1,
    status       VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by   VARCHAR(64) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, code)
);
CREATE INDEX idx_apps_tenant_status ON apps(tenant_id, status);

-- ----------------------------------------------------------------------------
-- app_objects: 对象元数据
-- ----------------------------------------------------------------------------
CREATE TABLE app_objects (
    id               BIGSERIAL PRIMARY KEY,
    app_id           BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    code             VARCHAR(64) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    schema_json      TEXT NOT NULL,
    data_table_name  VARCHAR(128) NOT NULL,
    ontology_object_id VARCHAR(128),
    version          INTEGER NOT NULL DEFAULT 1,
    created_by       VARCHAR(64) NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, code)
);
CREATE INDEX idx_objects_app ON app_objects(app_id);

-- ----------------------------------------------------------------------------
-- app_forms: 表单定义
-- ----------------------------------------------------------------------------
CREATE TABLE app_forms (
    id           BIGSERIAL PRIMARY KEY,
    app_id       BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    object_id    BIGINT NOT NULL REFERENCES app_objects(id) ON DELETE CASCADE,
    code         VARCHAR(64) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    schema_json  TEXT NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'draft',
    version      INTEGER NOT NULL DEFAULT 1,
    created_by   VARCHAR(64) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (object_id, code)
);
CREATE INDEX idx_forms_object ON app_forms(object_id);
CREATE INDEX idx_forms_status ON app_forms(status);

-- ----------------------------------------------------------------------------
-- app_workflows: 流程定义 (v1.0.1 简化版：开始→用户任务→结束)
-- ----------------------------------------------------------------------------
CREATE TABLE app_workflows (
    id           BIGSERIAL PRIMARY KEY,
    app_id       BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    form_id      BIGINT NOT NULL REFERENCES app_forms(id) ON DELETE CASCADE,
    code         VARCHAR(64) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    nodes_json   TEXT NOT NULL,
    edges_json   TEXT NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'draft',
    version      INTEGER NOT NULL DEFAULT 1,
    created_by   VARCHAR(64) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (form_id, code)
);
CREATE INDEX idx_workflow_form ON app_workflows(form_id);

-- ----------------------------------------------------------------------------
-- app_workflow_instances: 流程实例
-- ----------------------------------------------------------------------------
CREATE TABLE app_workflow_instances (
    id             BIGSERIAL PRIMARY KEY,
    workflow_id    BIGINT NOT NULL REFERENCES app_workflows(id) ON DELETE CASCADE,
    form_data_id   BIGINT NOT NULL,
    current_node_id VARCHAR(64),
    status         VARCHAR(32) NOT NULL DEFAULT 'running',
    payload_json   TEXT,
    created_by     VARCHAR(64) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at   TIMESTAMP
);
CREATE INDEX idx_instance_workflow ON app_workflow_instances(workflow_id);
CREATE INDEX idx_instance_status ON app_workflow_instances(status, current_node_id);

-- ----------------------------------------------------------------------------
-- app_todos: 待办
-- ----------------------------------------------------------------------------
CREATE TABLE app_todos (
    id                    BIGSERIAL PRIMARY KEY,
    workflow_instance_id  BIGINT NOT NULL REFERENCES app_workflow_instances(id) ON DELETE CASCADE,
    node_id               VARCHAR(64) NOT NULL,
    assignee_id           VARCHAR(64) NOT NULL,
    status                VARCHAR(32) NOT NULL DEFAULT 'pending',
    comment               TEXT,
    due_at                TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    done_at               TIMESTAMP
);
CREATE INDEX idx_todos_assignee_status ON app_todos(assignee_id, status);
CREATE INDEX idx_todo_instance ON app_todos(workflow_instance_id);

-- ----------------------------------------------------------------------------
-- app_audit_logs: 审计日志（横切关注）
-- ----------------------------------------------------------------------------
CREATE TABLE app_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    resource_type   VARCHAR(32) NOT NULL,
    resource_id     BIGINT,
    action          VARCHAR(32) NOT NULL,
    actor           VARCHAR(64) NOT NULL,
    payload         TEXT,
    trace_id        VARCHAR(64),
    tenant_id       VARCHAR(64),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_resource ON app_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON app_audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- app_idempotency: 幂等键
-- ----------------------------------------------------------------------------
CREATE TABLE app_idempotency (
    id              BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    request_hash    VARCHAR(64) NOT NULL,
    response_json   TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL
);
CREATE INDEX idx_idempotency_expires ON app_idempotency(expires_at);

-- ----------------------------------------------------------------------------
-- ARCHITECTURE_NOTE
-- ----------------------------------------------------------------------------
-- 动态业务数据表的归属：
--   Sprint 0 期间，app-service 自己管理 data_{app}_{obj}_{hash} 的 DDL；
--   ontology-engine 只提供 ObjectType 语义层的接口。
--   本 schema 表本身不存储 data_{xxx}；运行时创建并通过 SqlRunner 查询。
-- ============================================================================
