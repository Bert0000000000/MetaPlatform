# v1.0.1 新建服务：metaplatform-app-service 架构说明

> **目的**：把"应用中心"作为独立微服务落地，避免主 API 在 v1.1.0 / v1.2.0 期间膨胀失控。
>
> **配套**：[`01-user-stories.md`](./01-user-stories.md) · [`02-sprint-plan.md`](./02-sprint-plan.md)
> **创建时间**：Sprint 0

---

## 〇、为什么需要这个新服务

### 0.1 当前架构

```
┌────────────────────────────────────────────────────────────────┐
│  metaplatform-frontend (React 19 :5173)                        │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  metaplatform-api (Express :3001) — 64 个 API 端点             │
│  /apps /ontology /processes /knowledge /data /quality ...     │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  metaplatform-ontology-engine (Spring Boot :8090) — Java       │
│  metaplatform-page-generator (Spring Boot :8083) — Java         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  SQLite 数据库（54 张表）                                       │
└────────────────────────────────────────────────────────────────┘
```

### 0.2 核心痛点

- **应用中心只有 5 个 API**：现在做应用+表单+流程+列表+审批，预计要新增 **+18 个 API**
- **如果都堆在 metaplatform-api**：到 v1.1.0 + v1.2.0，这个服务会超过 100 个 API，难以维护
- **领域耦合**：应用编排（应用 + 对象 + 表单 + 流程 + 审批）是紧密耦合的领域，独立服务能减少跨域影响

### 0.3 目标

把"应用中心"独立为 `metaplatform-app-service`，主 API 只保留转发 + 鉴权。

---

## 一、新架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  metaplatform-frontend (:5173)                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓ HTTP
┌─────────────────────────────────────────────────────────────────────┐
│  metaplatform-api (:3001) — 网关层                                   │
│  • 鉴权 (JWT)                                                        │
│  • 路由聚合                                                          │
│  • /api/apps/**     ──┐                                              │
│  • /api/ontology/**   │                                              │
│  • /api/knowledge/**  │ 转发到对应后端服务                          │
│  • /api/quality/**    │                                              │
│  • 其他模块…        ──┘                                              │
└─────────────────────────────────────────────────────────────────────┘
        │                │                │                │
        ▼                ▼                ▼                ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│🆕 app-service    │  │ ontology-engine  │  │ page-generator   │
│   (:3002)        │  │   (:8090)        │  │   (:8083)        │
│                  │  │                  │  │                  │
│ • 应用 CRUD      │  │ • 本体模型       │  │ • 页面渲染       │
│ • 对象管理       │  │ • 对象类型       │  │ • TABLE/FORM     │
│ • 表单 schema    │  │ • 字段类型       │  │                  │
│ • 列表查询       │  │ • 校验引擎       │  │                  │
│ • 流程编排       │  │                  │  │                  │
│ • 审批执行       │  │                  │  │                  │
│ • 字段权限       │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                                                            
        ▼                                                            
┌─────────────────────────────────────────────────────────────────────┐
│  SQLite 数据文件                                                       │
│  • app.db（app-service 自己的库）                                   │
│  • ontology.db                                                       │
│  • metaplatform.db（主库）                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、metaplatform-app-service 内部结构

### 2.1 技术栈

| 项 | 选型 |
|----|------|
| 运行时 | Node.js 18+ |
| 框架 | Express 4 |
| 语言 | TypeScript 5.x |
| 数据库 | SQLite（better-sqlite3） |
| ORM | 不使用 ORM（用 Repository 模式 + raw SQL，便于事务控制和优化） |
| 测试 | Jest + supertest |
| API 文档 | OpenAPI 3.0 自动生成 |
| 鉴权 | JWT（由 metaplatform-api 颁发，app-service 校验签名） |

### 2.2 目录结构（规划）

```
metaplatform-app-service/
├── package.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── index.ts                       # 入口（:3002）
│   ├── config.ts                      # 配置
│   ├── db/
│   │   ├── app.db.ts                  # 数据库连接
│   │   ├── migrations/                # SQL 迁移脚本
│   │   │   ├── 001_init.sql
│   │   │   ├── 002_apps.sql
│   │   │   ├── 003_objects.sql
│   │   │   ├── 004_forms.sql
│   │   │   ├── 005_workflow.sql
│   │   │   └── 006_audit.sql
│   │   └── seeds/
│   │       └── dev.sql                # 种子数据
│   ├── routes/                        # HTTP 路由
│   │   ├── apps.routes.ts             # /api/apps/**
│   │   ├── objects.routes.ts          # /api/apps/:id/objects/**
│   │   ├── forms.routes.ts            # /api/apps/:id/forms/**
│   │   ├── list.routes.ts             # /api/apps/:id/forms/:fid/list
│   │   ├── workflow.routes.ts         # /api/apps/:id/forms/:fid/workflow/**
│   │   ├── todo.routes.ts             # /api/todos
│   │   └── approval.routes.ts         # /api/workflow/instances/:id
│   ├── domain/                        # 领域层
│   │   ├── app/
│   │   │   ├── app.entity.ts
│   │   │   ├── app.repository.ts
│   │   │   └── app.service.ts
│   │   ├── object/
│   │   ├── form/
│   │   ├── form-data/
│   │   ├── workflow/
│   │   └── approval/
│   ├── clients/                       # 外部服务客户端
│   │   ├── ontology.client.ts         # REST → :8090
│   │   ├── page.client.ts             # REST → :8083
│   │   └── api.client.ts              # 转发 → :3001（如需回查用户）
│   ├── middleware/
│   │   ├── jwt-auth.middleware.ts     # JWT 校验
│   │   ├── rbac.middleware.ts         # 角色权限
│   │   ├── error-handler.middleware.ts
│   │   └── audit-log.middleware.ts
│   └── utils/
│       ├── sql-escape.ts
│       ├── pagination.ts
│       └── csv.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/                            # 仅在服务内做集成
```

### 2.3 数据模型（v1.0.1 用到的 6 张表）

> 详细 DDL 在 `src/db/migrations/` 下，仅列设计意图。

```sql
-- 1. 应用表
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,            -- 多租户
  code TEXT UNIQUE NOT NULL,          -- 应用的英文代号（用于表名前缀）
  name TEXT NOT NULL,                 -- 显示名
  icon TEXT,                          -- icon 名
  description TEXT,
  version INTEGER DEFAULT 1,          -- 应用 schema 版本号
  status TEXT DEFAULT 'active',       -- active / archived
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 对象表（对象的元数据）
CREATE TABLE app_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  code TEXT NOT NULL,                 -- 英文代号（用于表名后缀）
  name TEXT NOT NULL,                 -- 显示名
  description TEXT,
  schema_json TEXT NOT NULL,          -- 字段定义 JSON
  ontology_object_id INTEGER,         -- 对应 ontology-engine 的对象 ID
  data_table_name TEXT NOT NULL,      -- 数据存哪张表（如 app_demo_xxx_reimbursement）
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_id, code)
);

-- 3. 表单定义表
CREATE TABLE app_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  object_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_json TEXT NOT NULL,          -- 字段控件映射 + 布局
  status TEXT DEFAULT 'draft',        -- draft / published / archived
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(object_id, code)
);

-- 4. 表单数据表（动态创建，命名 app_<code>_<hash>）
-- 由 ontology-engine 物理创建，app-service 仅查询

-- 5. 流程定义表
CREATE TABLE app_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  form_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  nodes_json TEXT NOT NULL,           -- 节点定义 JSON
  edges_json TEXT NOT NULL,           -- 边定义 JSON
  status TEXT DEFAULT 'draft',        -- draft / published / archived
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(form_id, code)
);

-- 6. 流程实例表
CREATE TABLE app_workflow_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  form_data_id INTEGER NOT NULL,      -- 关联表单数据
  current_node_id TEXT,
  status TEXT DEFAULT 'running',      -- running / completed / rejected / cancelled
  payload_json TEXT,                  -- 当前变量快照
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- 7. 待办表
CREATE TABLE app_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_instance_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',      -- pending / done / cancelled
  comment TEXT,
  due_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  done_at DATETIME
);

-- 8. 审计日志（横切关注，每张表都有对应 audit）
CREATE TABLE app_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,
  resource_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT,
  trace_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 API 端点（v1.0.1 共 18 个）

#### 应用（apps）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps` | 应用列表 |
| POST | `/api/apps` | 新建应用 |
| GET | `/api/apps/:id` | 应用详情 |
| PUT | `/api/apps/:id` | 更新应用 |
| DELETE | `/api/apps/:id` | 删除应用（软删） |

#### 对象（objects）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps/:id/objects` | 对象列表 |
| POST | `/api/apps/:id/objects` | 新建对象（含批量字段） |
| GET | `/api/apps/:id/objects/:oid` | 对象详情 |
| PUT | `/api/apps/:id/objects/:oid` | 更新对象（仅非结构性字段） |
| DELETE | `/api/apps/:id/objects/:oid` | 删除对象 |

#### 表单（forms）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/apps/:id/forms` | 表单列表 |
| POST | `/api/apps/:id/forms` | 新建表单 |
| GET | `/api/apps/:id/forms/:fid` | 表单详情 |
| PUT | `/api/apps/:id/forms/:fid` | 更新表单 |
| POST | `/api/apps/:id/forms/:fid/publish` | 发布表单 |

#### 提交 + 列表（submit / list）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/apps/:id/forms/:fid/submit` | 提交表单 |
| GET | `/api/apps/:id/forms/:fid/list` | 列表查询（分页+排序+过滤） |
| GET | `/api/apps/:id/forms/:fid/csv` | CSV 导出 |

#### 流程（workflow）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/apps/:id/forms/:fid/workflow` | 创建 / 更新流程 |
| GET | `/api/apps/:id/forms/:fid/workflow` | 流程详情 |
| POST | `/api/workflow/instances/:id/approve` | 审批通过 |
| POST | `/api/workflow/instances/:id/reject` | 审批驳回 |

#### 待办（todos）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/todos` | 当前用户待办列表 |

---

## 三、与现有服务的对接

### 3.1 与 ontology-engine 的关系（**Sprint 0 已修正**）

- **调用方式**：REST（HTTP 客户端，详见 `src/clients/ontology.client.ts`）
- **调用点**：创建/修改对象时，app-service 调用 ontology-engine 的 `POST /api/v1/object-types` 让 ontology-engine 创建**领域类型定义**
- **耦合度**：单向耦合（app-service → ontology-engine）
- **失败处理**：如果 ontology-engine 调用失败，事务回滚，app-service 表回滚（在同一 SQLite 事务内）

#### ⚠️ 重要：动态数据表的所有权已从 ontology-engine 调整到 app-service

**原设计**（[v0 规划](https://www.example.com/roadmap-v0)）：让 ontology-engine 物理建数据表
**Sprint 0 实际调研**：ontology-engine 是 Java 抽象实体层（`ObjectTypeController.java` / `ObjectInstanceController.java`），它管理"领域类型 + 字段语义 + 生命周期"，**不直接发 DDL**

**修正后的设计**（[Sprint 0 已落地](docs/v1.0.x/v1.0.1/05-app-service-architecture.md)）：

| 能力 | 归属 | 文件 |
|------|------|------|
| **领域类型定义 + 字段语义** | ontology-engine | `ObjectTypeController.java` + `FieldDefinition` |
| **物理数据表 DDL + 数据入库** | app-service | `src/db/connection.ts::createDataTable` |
| **字段运行时校验** | app-service 本地优先，ontology 提供权威校验 | `src/clients/ontology.client.ts::validateFieldValue` |
| **对象实例生命周期** | ontology-engine | `ObjectInstanceController.java`（v1.0.1 暂未使用） |

这样调整的好处：
1. **更可靠**：DDL 与应用层在同一 SQLite 事务，原子性可保证
2. **更灵活**：字段类型变更时能立即生效，不必等 ontology-engine 发版
3. **更简单**：少了一层 RPC 跳跃，调试方便

#### 表命名规范（Sprint 0 定稿）

```
data_<appCode>_<objectCode>_<8位hash>

例：data_travel_reimbursement_a1b2c3d4
```

由 `createDataTable()` 自动生成，删除对象时 `dropDataTable()` 级联删除。

### 3.2 与 page-generator 的关系

- **调用方式**：REST（HTTP 客户端）
- **调用点**：表单保存时，app-service 调用 page-generator 的渲染 API 校验 schema
- **耦合度**：单向弱耦合（仅校验）

### 3.3 与 metaplatform-api 的关系

- **调用方式**：HTTP 反向代理
- **调用点**：前端访问 `/api/apps/**` 时，metaplatform-api 转发到 `localhost:3002/api/apps/**`
- **耦合度**：网关层耦合，app-service 不感知 metaplatform-api 存在

### 3.4 与 metaplatform-frontend 的关系

- **直接调用**：前端直接连 app-service（绕过网关）
- **开发期**：可通过 `package.json` 配置 `proxy: "http://localhost:3002"`
- **生产期**：通过 Nginx 反向代理

---

## 四、安全设计

### 4.1 鉴权链路

```
前端 ── Bearer JWT ──► metaplatform-api ──► app-service
                                            ├─ 校验 JWT 签名
                                            ├─ 校验 path 中的 app_id 归属当前 tenant
                                            └─ 校验当前用户的角色权限
```

### 4.2 字段权限

- 财务角色可以看金额、内部备注
- 申请人只能看自己的报销 + 公开字段
- 通过中间件 `field-permission.middleware.ts` 拦截

### 4.3 数据隔离

- 每次查询都强制加 `tenant_id` 过滤
- 通过索引强制隔离：`UNIQUE(tenant_id, code)`

---

## 五、性能设计

### 5.1 数据库索引

```sql
CREATE INDEX idx_apps_tenant ON apps(tenant_id);
CREATE INDEX idx_objects_app ON app_objects(app_id);
CREATE INDEX idx_forms_object ON app_forms(object_id);
CREATE INDEX idx_workflow_form ON app_workflows(form_id);
CREATE INDEX idx_instance_workflow ON app_workflow_instances(workflow_id);
CREATE INDEX idx_todos_assignee ON app_todos(assignee_id, status);
CREATE INDEX idx_todo_instance ON app_todos(workflow_instance_id);
```

### 5.2 连接池

- Node.js better-sqlite3 是同步连接，单进程使用一个连接即可
- 并发能力主要靠 SQLite WAL 模式 + 适当的写锁超时

### 5.3 响应格式

```json
// 成功
{
  "code": 0,
  "data": {...},
  "traceId": "..."
}

// 失败
{
  "code": 400,
  "message": "必填字段缺失：金额",
  "traceId": "..."
}
```

---

## 六、可观测性

### 6.1 日志

- 关键路由 log 请求 + 响应时间
- 错误 stack 一律打印
- 日志格式：JSON（便于后续接入 ELK）

### 6.2 traceId 贯通

- 网关生成 traceId → 透传到所有下游服务
- 每个响应都带 traceId 返回前端
- 前端错误页面显示 traceId 便于排查

---

## 七、CI / CD

### 7.1 GitHub Actions

```yaml
name: app-service-ci

on:
  push:
    branches: [main, release/v1.0.*]
    paths:
      - 'metaplatform-app-service/**'
  pull_request:
    paths:
      - 'metaplatform-app-service/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: metaplatform-app-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npm run build
```

### 7.2 部署

- 开发：`npm run dev`（:3002）
- 生产：构建后用 `pm2 start dist/index.js` 或 Docker

---

## 八、子项目目录注册

### 8.1 根 README 同步更新（提交时一并处理）

`/README.md` 中需要新增 `metaplatform-app-service` 的快速开始说明。

### 8.2 metaplatform-api 同步更新（提交时一并处理）

`metaplatform-api/src/index.js` 中需要把 `/api/apps/**` 转发到 `:3002`。

### 8.3 metaplatform-frontend 同步更新（提交时一并处理）

`metaplatform-frontend/package.json` 中添加 `proxy: "http://localhost:3002"`。

---

## 九、FAQ

### Q1：为什么不用 NestJS / Fastify / Koa？

A：
- 复用 metaplatform-api 的 Express 经验，团队熟悉度高
- 框架无关业务，统一通过 Repository 模式注入
- 性能足够（v1.0.1 体量 < Express 极限的 1%）

### Q2：为什么不用 ORM（Prisma / TypeORM）？

A：
- Schema 是动态的（用户能加字段），ORM 难以处理
- 用 Repository + raw SQL，对动态表友好
- 性能更好（少一层抽象）

### Q3：为什么不用 PostgreSQL？

A：
- v1.0.1 暂时轻量，SQLite 够用
- 后期可平滑迁移到 PostgreSQL（Repository 模式封装了）

### Q4：v1.1.0 引入 Deerflow 时，app-service 会变成什么样？

A：
- 增加一个 agent 客户端目录 `src/clients/agent.client.ts`
- 增加一个 webhook 接收端点 `/api/agent/callback`
- 主领域层不动

### Q5：app-service 与 metaplatform-api 的数据库能合并吗？

A：
- **暂时保持分离**：app-service 用独立的 app.db，主 API 用 metaplatform.db
- **未来可合并**：到 v2.0 时统一为 metaplatform.db（用 tenant_id 区分）

---

## 文档版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-10 | 初版（v1.0.1 新建服务架构） |
| v1.1 | 2026-07-10 | 推倒重做为 Java 工程（14 main 类 + 8 Flyway 迁移 + 11 JUnit 测试，全绿） |

### 0.x 版本说明（2026-07-10）

- **v1.0.1 期间**首次用 Node.js + TypeScript 实现（28 文件，95 个测试，全绿）
- **2026-07-10 由于用户指出"需要符合整体架构" → 推倒重做为本 Java 工程**
- 重做后：14 个 main 类 + 8 张 Flyway 表迁移 + 11 个 JUnit 测试，全绿
- 与 ontology-engine、platform-base 等 8 个 Java 微服务完全同栈
