# MetaPlatform

企业级 AI 中台产品 — 基于 Schema 驱动的低代码平台

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MetaPlatform v1.0.0                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │   Frontend   │───▶│  Node.js API │───▶│   SQLite     │           │
│  │  React 19    │    │  Express 4   │    │   Database   │           │
│  │  :5173       │    │  :3001       │    │   54 tables  │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         │                    │                    │                   │
│         └────────────────────┼────────────────────┘                  │
│                              ▼                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │ shadcn/ui    │    │  27 路由模块  │    │  种子数据     │           │
│  │ Tailwind 4   │    │  64 API 端点  │    │  54 表       │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐                                │
│  │ Java Ontology│    │ Page Generator│                               │
│  │ Engine :8090 │    │    :8083     │                                │
│  └──────────────┘    └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置条件

- Node.js 18+（前端 + API 服务器）
- Java 21+（本体引擎，可选）
- Maven 3.8+（Java 项目构建，可选）

### 1. 启动后端 API

```bash
cd metaplatform-api
npm install
node src/index.js
# → http://localhost:3001
# → SQLite 数据库自动创建，种子数据自动注入
```

### 2. 启动前端

```bash
cd metaplatform-frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. 生产构建

```bash
cd metaplatform-frontend
npm run build
# → dist/ 目录，可部署到任意静态服务器
```

## 📁 项目结构

```
MetaPlatform/
├── metaplatform-api/                 # Node.js Express 后端 API（v1.0）
│   ├── src/index.js                  # 入口，27 个路由模块注册
│   ├── src/db.js                     # SQLite + 54 表迁移 + 种子数据
│   └── src/routes/                   # 27 个路由文件
├── metaplatform-frontend/            # React 19 前端应用
│   ├── src/lib/api.ts                # API 客户端层（64 个端点）
│   ├── src/pages/                    # 12 个一级菜单页面
│   └── src/components/               # UI 组件库（shadcn/ui + 流程设计器）
├── metaplatform-ontology-engine/     # Java 本体引擎（Spring Boot 3.2）
├── metaplatform-page-generator/      # Java 页面生成器
├── CHANGELOG.md                      # 变更日志
└── README.md                         # 本文件
```

## 🎯 核心功能（12 个模块）

| 模块 | 路径 | API 数 | 数据库表 | 功能 |
|------|------|--------|---------|------|
| 工作台 | `/dashboard` | 5 | 4 | 统计概览、最近活动、公告、推荐 |
| 应用中心 | `/apps` | 1 | 1 | 应用列表、创建、编辑、部署 |
| 超级 AI | `/superai` | 5 | 3 | AI 对话、智能体、任务管理、知识库 |
| 架构中心 | `/architecture` | 4 | 1 | 业务/应用/数据/技术架构、价值链编辑 |
| 流程中心 | `/process` | 2 | 2 | 流程定义、BPMN 设计器、流程实例 |
| 数据中心 | `/data` | 6 | 5 | 数据源、ETL、质量规则、NL2SQL |
| 本体引擎 | `/ontology` | 6 | 7 | 对象、属性、关系、动作、安全规则 |
| 知识库 | `/knowledge` | 9 | 5 | 文档、搜索、QA、图谱、处理任务 |
| 质量中心 | `/quality` | 10 | 6 | 测试用例、Bug、AI 修复、报告 |
| 云市场 | `/market` | 6 | 6 | 模板、开发者、Skill、工作流 |
| 数字员工 | `/agents` | 5 | 3 | 数字员工、技能广场、协作、监控 |
| 后台管理 | `/admin` | 4 | 4 | 用户、角色、部门、配置、LLM |

## 🔧 API 端点清单（64 个）

### Node.js API (:3001)

| 模块 | 端点数 | 主要端点 |
|------|--------|---------|
| 认证 | 3 | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| 应用 | 5 | `GET/POST/PUT/DELETE /apps` |
| 本体引擎 | 16 | `GET/POST /ontology/objects`, `/relations`, `/actions`, `/functions`, `/rules`, `/security-rules`, `/auto-numbers` |
| 流程 | 5 | `GET/POST /processes`, `PUT /processes/:id` |
| 知识库 | 12 | `GET/POST /knowledge/documents`, `/search`, `/qa`, `/graph/nodes`, `/graph/edges`, `/processing-jobs`, `/subscriptions` |
| 数字员工 | 5 | `GET/POST /agents`, `GET /agents/:id/tasks` |
| 数据 | 11 | `GET/POST /data/sources`, `/metrics`, `/etl-tasks`, `/quality-rules`, `/realtime-events`, `POST /data/ask` |
| 质量 | 14 | `GET/POST /quality/cases`, `/bugs`, `/stats`, `/ontology-tests`, `/ui-tests`, `/process-tests`, `/ai-fixes`, `/reports` |
| 云市场 | 9 | `GET/POST /market/templates`, `/developers`, `/skills`, `/workflow-templates`, `/knowledge-packages`, `/api-library` |
| 后台管理 | 6 | `GET /admin/users`, `/roles`, `/config`, `/llm-config` |
| 消息 | 1 | `GET /messages` |
| 公告 | 1 | `GET /announcements` |
| 待办 | 1 | `GET /todos` |
| 触发器 | 1 | `GET /triggers` |
| 编排 | 1 | `GET /orchestrations` |
| LLM | 2 | `GET /llm/models`, `POST /llm/chat` |
| 调度 | 2 | `GET /dispatch/agents`, `POST /dispatch/execute` |
| 架构 | 4 | `GET/PUT /architecture/ba`, `/aa`, `/da`, `/ta` |

### Java Ontology Engine (:8090)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/entity-types` | 创建 EntityType |
| POST | `/api/v1/object-types` | 创建 ObjectType |
| GET | `/api/v1/object-types/code/{code}` | 按 code 查询 |
| POST | `/api/v1/object-instances` | 创建实例 |
| GET | `/api/v1/object-instances` | 查询实例列表 |
| POST | `/api/v1/object-instances/{id}/transition` | 生命周期流转 |

## 📊 当前状态

| 子项目 | 版本 | 状态 | 核心能力 |
|--------|------|------|----------|
| **Node.js API** | **v1.0** | **✅ 生产就绪** | **27 路由模块 + 64 API 端点 + 54 数据库表** |
| **React Frontend** | **v1.0** | **✅ 生产就绪** | **12 个页面 + 64 个 API 对接 + 零硬编码** |
| Ontology Engine | v0.6 | ✅ | 25 种字段类型 + 校验引擎 + 生命周期守卫 |
| AI Substrate | v0.2 | ✅ | LLM 客户端 + NL 建模 + AI 字段生成 |
| Knowledge (RAG) | v0.1 | ✅ | 文档摄入 + 分块 + 嵌入 + 语义搜索 |
| Dialogue | v0.1 | ✅ | NL 解析器 + 上下文记忆 + 6 种意图 |
| Capability Library | v0.2 | ✅ | 12 个原子能力 + Pipeline 编排 |
| Integration Hub | v0.1 | ✅ | REST/DB/CSV 连接器 + 数据同步 |
| Page Generator | v0.2 | ✅ | Schema 生成 + TABLE/FORM/KANBAN 渲染 |
| Data Stack | v0.2 | ✅ | Doris + ClickHouse + Hudi 骨架 |
| Platform Base | v0.1 | ✅ | 多租户 + RBAC 接口 |

## 🧪 测试

### API 端到端测试

```bash
# 启动后端
cd metaplatform-api && node src/index.js

# 测试所有端点
curl http://localhost:3001/api/apps
curl http://localhost:3001/api/ontology/objects
curl http://localhost:3001/api/knowledge/documents
curl http://localhost:3001/api/quality/cases
curl http://localhost:3001/api/market/templates
curl http://localhost:3001/api/architecture/ba
# ... 共 64 个端点
```

### TypeScript 编译检查

```bash
cd metaplatform-frontend
npx tsc --noEmit
```

### 生产构建

```bash
cd metaplatform-frontend
npm run build
```

## 📝 开发指南

### 添加新 API 端点

1. 在 `metaplatform-api/src/db.js` 添加数据库表和种子数据
2. 在 `metaplatform-api/src/routes/xxx.js` 添加路由
3. 在 `metaplatform-api/src/index.js` 注册路由（如需新文件）
4. 在 `metaplatform-frontend/src/lib/api.ts` 添加 API 方法
5. 在页面组件中调用 API 方法

### 添加新页面

1. 在 `metaplatform-frontend/src/pages/` 创建页面组件
2. 在 `metaplatform-frontend/src/App.tsx` 添加路由
3. 在侧边栏菜单中添加入口

## 📄 许可证

MIT License

## 🔗 链接

- [GitHub 仓库](https://github.com/Bert0000000000/MetaPlatform)
- [变更日志](CHANGELOG.md)
