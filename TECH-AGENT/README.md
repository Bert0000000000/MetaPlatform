# TECH-AGENT - Agent 框架服务

## 模块类型

TECH 模块

## 作用

Mate Platform 的 Agent 框架服务，提供数字员工与 Agent 运行时能力。当前阶段已实现 **Agent 定义管理 CRUD**，向上承接 APP-DW 数字员工与 APP-SUPERAI 超级 AI 应用的 Agent 调度需求，向下通过 TECH-LLMGW 统一调用大模型、通过 TECH-RAG 实现知识检索、通过 TECH-ACTION 执行业务动作。

## 上游依赖

- `TECH-LLMGW`：所有 LLM 调用通过 LLM Gateway
- `TECH-RAG`：Agent 知识检索
- `TECH-ACTION`：业务动作执行
- `TECH-ONT`：本体概念引用
- `TECH-IAM`：用户/租户/权限校验
- `TECH-MSG`：Kafka 事件基础设施

## 下游消费

- `APP-DW`：数字员工管理、Agent 执行调度
- `APP-SUPERAI`：超级 AI 应用的 Agent 执行
- `TECH-A2A`：跨系统 Agent 协作
- `APP-DASHBOARD`：Agent 运行统计
- `APP-APPHUB`：低代码应用嵌入 Agent 能力

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Python + FastAPI | 3.13 / 0.115+ | 服务主体 |
| Agent 框架 | LangChain + LangGraph | 0.3 / 0.2+ | Agent 编排与执行引擎 |
| 验证 | Pydantic | v2 | Schema 与配置 |
| 关系数据库 | PostgreSQL / SQLite | 17 / 3.x | Agent 定义持久化（SQLAlchemy 2.0） |
| 缓存 | Redis | 7.4 | 执行状态、短期记忆（Phase 2+） |
| 消息队列 | Kafka | 3.9 | 事件发布（Phase 2+，Outbox 模式） |
| 链路追踪 | OpenTelemetry | 1.45+ | trace_id 传播 |

## 端口

```
HTTP: 8501
```

## 目录结构

```
TECH-AGENT/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── agents.py        # Agent 定义 CRUD 端点
│   │       └── router.py        # v1 聚合路由
│   ├── agents/
│   │   ├── orm.py               # SQLAlchemy 2.0 ORM 模型
│   │   ├── repository.py        # 仓库抽象 + 内存 / SQLAlchemy 实现
│   │   ├── schemas.py           # Pydantic v2 模型
│   │   └── service.py           # Agent 业务服务
│   ├── common/                  # 公共模块
│   │   ├── api_response.py      # 统一响应封装
│   │   ├── context.py           # 租户/用户/trace 上下文
│   │   ├── errors.py            # 业务异常与错误码
│   │   ├── jwt_auth.py          # JWT 鉴权
│   │   └── middleware.py        # 全局异常处理与 trace 中间件
│   ├── config.py                # Pydantic Settings 配置
│   └── deps.py                  # 服务注册表 & FastAPI 依赖注入
├── tests/
│   ├── conftest.py              # 共享 fixtures
│   ├── test_agent_service.py    # 服务层单元测试
│   └── test_controllers.py      # HTTP 控制器测试
├── docs/
│   └── SPEC-TECH-AGENT-Agent框架API规范_v1.0-20260716.md
├── main.py                      # FastAPI 入口
├── pyproject.toml               # 项目依赖与构建配置
└── README.md                    # 本文件
```

## 通用约定

- **路径前缀**：`/api/v1/agent`
- **统一响应**：`{code, message, data, traceId}`（`code=0` 成功）
- **租户隔离**：`X-Tenant-Id` 必填；或从 `Authorization: Bearer <jwt>` 解 `tenantId` claim；测试态默认 `tenant-default`
- **trace_id**：`X-Trace-Id` 透传，否则服务端生成 UUID v4
- **错误码**：见 `app/common/errors.py`

## Agent 定义模型

| 字段 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID（UUID） |
| code | string | 业务唯一标识，同一租户内唯一 |
| name | string | Agent 名称 |
| description | string | Agent 描述 |
| modelId | string | 模型 ID（通过 TECH-LLMGW 路由） |
| systemPrompt | string | 系统提示词 |
| tools | string[] | 工具引用 ID 列表 |
| ragScopes | string[] | RAG 知识范围引用 ID 列表 |
| temperature | float | 温度参数 |
| maxTokens | int | 最大生成 Token 数 |
| status | string | `DRAFT` / `ACTIVE` / `DISABLED` |
| tenantId | string | 租户 ID |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

## API 清单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/agent/agents` | 创建 Agent |
| GET | `/api/v1/agent/agents` | Agent 列表（分页 + 状态筛选） |
| GET | `/api/v1/agent/agents/{agentId}` | Agent 详情 |
| PUT | `/api/v1/agent/agents/{agentId}` | 更新 Agent |
| DELETE | `/api/v1/agent/agents/{agentId}` | 删除 Agent（ACTIVE 状态不可删除） |
| GET | `/api/v1/agent/health` | 健康检查 |

## 快速开始

### 本地运行

```bash
# 创建虚拟环境
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # Linux/macOS

# 安装依赖
pip install -e ".[dev]"

# 启动服务（默认 SQLite + 内存仓库）
python main.py
# -> http://localhost:8501/docs
```

### 数据库配置

默认使用内存仓库，无需数据库即可运行和测试。生产环境可通过环境变量配置 PostgreSQL：

```bash
DATABASE_URL=postgresql+asyncpg://meta:meta@localhost:5432/metaplatform_agent
python main.py
```

也可使用 SQLite：

```bash
DATABASE_URL=sqlite+aiosqlite:///./tech_agent.db
python main.py
```

### 运行测试

```bash
# 全部测试
pytest

# 仅控制器层
pytest tests/test_controllers.py

# 仅服务层
pytest tests/test_agent_service.py

# 仅某个测试
pytest tests/test_agent_service.py::TestAgentServiceCreate::test_create_agent_success
```

### 示例调用

```bash
# 1. 创建 Agent
curl -X POST http://localhost:8501/api/v1/agent/agents \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "采购助手",
    "code": "purchase-assistant",
    "description": "协助处理采购审批流程",
    "modelId": "doubao-pro-32k",
    "systemPrompt": "你是一个专业的采购助手。",
    "tools": ["tool-001"],
    "ragScopes": ["scope-001"],
    "temperature": 0.3,
    "maxTokens": 2048,
    "status": "DRAFT"
  }'

# 2. 查询 Agent 列表
curl http://localhost:8501/api/v1/agent/agents \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001"

# 3. 查询 Agent 详情
curl http://localhost:8501/api/v1/agent/agents/agt-xxx \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001"

# 4. 更新 Agent
curl -X PUT http://localhost:8501/api/v1/agent/agents/agt-xxx \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{"name": "更新后的名称", "status": "ACTIVE"}'

# 5. 删除 Agent
curl -X DELETE http://localhost:8501/api/v1/agent/agents/agt-xxx \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Id: tenant-001"
```

## 架构说明

### 仓库抽象

`AgentRepository` 是抽象接口，当前提供两种实现：

- `InMemoryAgentRepository`：线程安全内存存储，用于测试和本地默认运行
- `SqlAlchemyAgentRepository`：异步 SQLAlchemy 2.0 实现，支持 SQLite（aiosqlite）和 PostgreSQL（asyncpg）

Phase 2 之后可无缝替换为真实数据库存储，服务层与控制器层无需改动。

### 租户隔离

- 所有仓库方法强制传入 `tenant_id`
- `code` 在租户内唯一，跨租户可重复
- 列表查询严格按 `tenant_id` 过滤

### 错误流

所有业务异常继承 `BizException`，由 `app/common/middleware.py` 中的全局 handler 统一包装为 `ApiResponse`，并设置对应 HTTP 状态码。

## 相关文档

- [项目总览](../../README.md)
- [Agent 框架 API 规范](./docs/SPEC-TECH-AGENT-Agent框架API规范_v1.0-20260716.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)
- [版本路线图](../../docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md)
