-- ============================================================================
-- v1.0.1 Sprint 0 - metaplatform-app-service 数据库迁移
-- 文件：001_init.sql
-- 说明：
--   1. 8 张 app-service 自己的元数据表（应用/对象/表单/流程/待办/审计/幂等）
--   2. 索引 + 唯一约束
--   3. 与 ontology-engine 的边界（见文件末尾 ARCHITECTURE_NOTE）
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. apps：应用主表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,                   -- 英文代号（用于动态表名前缀）
  name TEXT NOT NULL,                   -- 显示名（中文）
  icon TEXT,                            -- icon 名
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,   -- 乐观锁版本号
  status TEXT NOT NULL DEFAULT 'active', -- active | archived
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_apps_tenant_status ON apps(tenant_id, status);

-- ----------------------------------------------------------------------------
-- 2. app_objects：对象元数据（V1.0.1 仅单对象，无关联）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                   -- 英文代号（用于动态表名后缀）
  name TEXT NOT NULL,                   -- 显示名
  description TEXT,
  schema_json TEXT NOT NULL,            -- 字段定义 JSON
  data_table_name TEXT NOT NULL,        -- 数据动态表名（app_<code>_<hash>）
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (app_id, code)
);
CREATE INDEX IF NOT EXISTS idx_objects_app ON app_objects(app_id);

-- ----------------------------------------------------------------------------
-- 3. app_forms：表单定义
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  object_id INTEGER NOT NULL REFERENCES app_objects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_json TEXT NOT NULL,            -- 字段控件映射 + 布局
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (object_id, code)
);
CREATE INDEX IF NOT EXISTS idx_forms_object ON app_forms(object_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON app_forms(status);

-- ----------------------------------------------------------------------------
-- 4. app_workflows：流程定义（v1.0.1 简化版，开始→用户任务→结束）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  form_id INTEGER NOT NULL REFERENCES app_forms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  nodes_json TEXT NOT NULL,             -- 节点定义 JSON 数组
  edges_json TEXT NOT NULL,             -- 边定义 JSON 数组
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (form_id, code)
);
CREATE INDEX IF NOT EXISTS idx_workflow_form ON app_workflows(form_id);

-- ----------------------------------------------------------------------------
-- 5. app_workflow_instances：流程实例
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL REFERENCES app_workflows(id) ON DELETE CASCADE,
  form_data_id INTEGER NOT NULL,        -- 关联 form_data 行（注意：动态表）
  current_node_id TEXT,                 -- 简化：当前节点 code
  status TEXT NOT NULL DEFAULT 'running', -- running | completed | rejected | cancelled
  payload_json TEXT,                    -- 当前变量快照（含表单数据）
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_instance_workflow ON app_workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_instance_status ON app_workflow_instances(status, current_node_id);

-- ----------------------------------------------------------------------------
-- 6. app_todos：待办
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL REFERENCES app_workflow_instances(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | cancelled
  comment TEXT,
  due_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  done_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_todos_assignee_status ON app_todos(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_todo_instance ON app_todos(workflow_instance_id);

-- ----------------------------------------------------------------------------
-- 7. app_audit_logs：审计日志（横切关注）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,          -- app | object | form | workflow | instance | todo
  resource_id INTEGER,
  action TEXT NOT NULL,                 -- create | update | delete | publish | approve | reject
  actor TEXT NOT NULL,
  payload TEXT,                         -- JSON
  trace_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON app_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON app_audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- 8. app_idempotency：幂等键（提交表单防重复）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_idempotency (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON app_idempotency(expires_at);

-- ============================================================================
-- ARCHITECTURE_NOTE：app-service 与 ontology-engine 的边界
-- ============================================================================
-- 原 05-architecture.md §3.1 设计是「ontology-engine 给动态表建物理表」
-- 经实际查阅 ontology-engine 源码发现（ObjectTypeController.java），
-- ontology-engine 是 Java 抽象实体层，不是动态建物理表的 DDL 层。
--
-- 故 v1.0.1 调整为：
--  1) app-service 自己管理动态数据表的 DDL（见 src/db/connection.ts::createDataTable）
--  2) ontology-engine 用作"领域类型 + 字段校验 + 生命周期"的语义层
--  3) 表单数据落 app-service 创建的 SQLite 表（如 app_reimbursement_<hash>）
--
-- 修正已同步到 docs/v1.0.x/v1.0.1/05-app-service-architecture.md §3.1
-- ============================================================================
