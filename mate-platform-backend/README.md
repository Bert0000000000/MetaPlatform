# mate-platform-backend

Mate Platform - Python 主后端 (v3.0 Plan D - Polyglot Microservice)

## 架构定位

Python 主后端 + Temporal 可靠编排控制面 + 专用外部引擎/AI 服务 + 多语言基础设施栈。

> ADR-0061 已接受 Temporal 作为业务 Workflow 引擎，PlanRunner 保留为 DSL 翻译层。Sprint 1A 迁移尚未完成，因此仓库中的 `mate-app-wfe` / `FlowableClient` 仍是双轨期 legacy 实现，不代表新增 Workflow 的目标架构。

详细架构见 [主架构实施版](../docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md)。

## 技术栈

- **包管理**: uv (Astral)
- **Web**: FastAPI 0.115+ + uvicorn + uvloop + granian
- **ORM**: SQLAlchemy 2.0 + SQLModel + Pydantic v2
- **HTTP**: httpx (唯一客户端)
- **可靠编排（目标态）**: Temporal Python SDK + PlanRunner/PlanSpec DSL；外部 I/O 放入幂等 Activity
- **LLM**: LangChain + LlamaIndex + LangGraph
- **类型检查**: pyright strict
- **测试**: pytest + pytest-asyncio + hypothesis
- **代码质量**: Ruff
- **弹性**: tenacity + pybreaker

## 项目结构

```
mate-platform-backend/
|-- pyproject.toml
|-- ruff.toml
|-- pyrightconfig.json
|-- contracts/openapi/           # Swagger/OpenAPI 3.1 契约
|-- packages/                    # 业务包
|   |-- mate-common/
|   |-- mate-tech-rag/
|   |-- mate-tech-agent/
|   |-- mate-tech-llmgw/
|   |-- mate-tech-ont/
|   |-- mate-tech-msg/
|   |-- mate-tech-obs/
|   |-- mate-tech-mcp/
|   `-- mate-app-kb/
|-- services/                    # 部署入口
|   |-- auth-service/
|   `-- api-gateway/
`-- rules/                       # Drools DRL 规则
```

## 快速开始

```bash
# 1. 安装依赖
uv sync

# 2. 类型检查
uv run pyright

# 3. 代码风格
uv run ruff check
uv run ruff format

# 4. 测试
uv run pytest

# 5. 启动 mate-tech-rag 服务（待实现）
uv run uvicorn mate_tech_rag.api.app:app --reload
```

## 开发规范

- **commit 规范**: Conventional Commits
- **接口契约**: OpenAPI 3.1 (PR 必跑 oasdiff)
- **Python 版本**: 3.12+ (Docker 镜像固定 3.12)

## 相关文档

- 主架构: `../docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`
- 技术栈定稿: `../docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
- Workflow ADR: `../docs/active/decisions/ADR-0061-temporal-as-workflow-engine.md`
- 交付计划: `../docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`

## API ?????API-GOV-01?

- ?????????`mate-platform-backend/contracts/openapi/`?
- ??????`mate-platform-backend/contracts/openapi/generated/bundled.yaml`????????
- ???????PRD Requirement ? OpenAPI 3.1 ? ???? ? Prism/SDK ? ???? ? ???? ? Runtime Diff ? E2E?
- `x-mate-implementation-status` ??? `planned`?`placeholder`?`implemented`??????????????
- Breaking change ???? `oasdiff` ??????
- Swagger?`/docs/swagger/index.html`?Redoc?`/docs/swagger/redoc.html`?Prism???local/docs profile?
