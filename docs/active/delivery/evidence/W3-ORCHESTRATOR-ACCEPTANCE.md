# W3 — mate-tech-orchestrator 编排服务：验收证据

> 批次：W3（新建 orchestrator 包）· 日期：2026-08-12
> 决策：蓝图 A3（新建 orchestrator 包，独立于 LangGraph）
> 上游：W1（A2A 官方 SDK）✅ / W2（MCP 动态注册表）✅
> 工作目录：`mate-platform-backend/packages/mate-tech-orchestrator`

## 1. 一句话验收

**新建 `mate-tech-orchestrator` 服务：复用 kernel `SuperAIOrchestrator`/`AgentSelector`/`AgentRole`，提供角色注册、单任务派发、计划执行（≥1 HITL，决策 B3）三组路由，把任务动态派发给 MCP/A2A 服务中心（worker）；18 tests 全绿，ruff/pyright 干净，契约 9 操作，docker-compose + api-gateway 已接线。**

## 2. 改动清单

| 文件 | 说明 |
|---|---|
| `packages/mate-tech-orchestrator/` | **新包**：pyproject / Dockerfile / README / src（main、api、scheduler、workers）/ tests |
| `scheduler/role_registry.py` | 数字员工角色注册表（租户隔离、动态注册/注销、kernel AgentRole 校验、capability→worker 绑定） |
| `scheduler/dispatcher.py` | 任务→角色→worker 路由（AgentSelector rid 前缀 / capability 匹配；mcp/a2a/http/local） |
| `scheduler/plan_runner.py` | kernel SuperAIOrchestrator + 逐步派发 + HITL 门（B3 ≥1 HITL） |
| `workers/mcp.py` `workers/a2a.py` | 服务中心 worker 适配层（ACL client） |
| `api/app.py` `api/schemas.py` | 8 端点 + 请求/响应模型 + outbox 事件 |
| `mate-clients/src/mate_clients/mcp/tools.py` `a2a/messages.py` | **新增 2 个 ACL client**（硬规则④） |
| `contracts/openapi/services/orchestrator.yaml` | 新契约：9 操作 |
| `docker-compose.yml` | 新增 `mate-tech-orchestrator` 服务（PORT 8505） |
| `services/api-gateway/main.py` | ROUTE_MAP 加 `/api/v1/orchestrator/` |
| 根 `pyproject.toml` | pytest pythonpath 加 orchestrator |

## 3. 测试证据

```
$ pytest packages/mate-tech-orchestrator/tests
18 passed, 18 warnings in 2.05s
$ pytest packages/mate-clients/tests
29 passed in 1.33s    # 新增 ACL client 不破坏既有
```

- `test_roles.py`：注册/列出/注销/未知角色 422/未知 worker_kind 422/租户隔离/outbox。
- `test_dispatch.py`：capability→MCP worker 派发、rid→A2A worker 派发、未知 capability 404、未注册角色 404、outbox。
- `test_plan_orchestration.py`：无 HITL 计划 422（B3）、execute 停在 HITL 步、review approve 完成 / reject 中止、未知计划 404、outbox。
- `test_tenant_integration.py`：跨租户角色不可见、跨租户派发 404、无 token 被拒。

## 4. 静态检查证据（硬规则 ⑥）

```
$ ruff check packages/mate-tech-orchestrator packages/mate-clients/src/mate_clients/mcp packages/mate-clients/src/mate_clients/a2a
  All checks passed
$ pyright-python packages/mate-tech-orchestrator/src ...
  0 errors, 0 warnings, 0 informations
```

## 5. 契约证据（硬规则 ①）

- `contracts/openapi/services/orchestrator.yaml`：9 操作（healthz + 3 roles + 1 dispatch + 4 plans），YAML 校验通过。

## 6. 偏离记录

1. **copilot 入口吸收 deferred**：蓝图 A3 说"吸收 mate-app-copilot 入口"，本轮 orchestrator 承担编排/派发职责；copilot 33 端点保持不动（吸收迁移留后续批次，计划中已明示边界）。
2. **worker auth**：`McpToolsClient`/`A2AMessagesClient` 支持注入 `BearerAuth`，生产服务身份 token 接线留后续（与服务间认证批次一起）。
3. `http` worker_kind 保留但拒绝执行（待 Pi-Agent / 外部 worker 批次接线）；`local` 为 SuperAI fallback（Pi Agent 对接点留注释）。
4. plan 状态存内存（kernel `SuperAIOrchestrator` 内存态），持久化留后续（与 SESSION-01 配合）。

## 7. 边界

- 未动：copilot、mate-tech-agent 既有路由、MCP/A2A 中心（W1/W2 已交付）。
- deferred：plan/role 持久化、worker 服务身份 auth、Pi Agent 接入、http worker。

## 8. 后续补充（2026-08-12）

- **worker 服务身份 auth 已落地**（原 deferred）：`workers/identity.py` 从 env（`KEYCLOAK_URL/REALM/SERVICE_CLIENT_ID/SECRET`）构造 `ServiceIdentity`（client_credentials，缓存续期），接入 `McpWorker`/`A2AWorker` 传给 ACL client（`OutgoingAuthMiddleware` 鸭子类型 `.token()`）；无 creds 时回退无认证（dev/test）。docker-compose orchestrator 服务已加对应 env。
  - 测试：`tests/test_workers.py` 4 用例（identity 有无 creds、worker 接线）。
- **跨服务 HTTP E2E 冒烟通过**（临时脚本，验证后删除）：
  - 起真实 uvicorn `mate-tech-mcp` + `mate-app-a2a` + mock worker 端点；
  - ACL client 用测试 token（`OutgoingAuthMiddleware` 路径）→ mcp 动态注册 `e2e_tool` → invoke → 转发 mock 返回 `{worker, answer:42}`；
  - a2a `POST /api/v1/a2a/messages` W3C envelope → 任务创建 `status: submitted`。
- 合并套件 **233 passed**（a2a 45 + mcp 137 + orchestrator 22 + mate-clients 29）。

## 9. W5 补充：角色持久化（2026-08-12）

原 deferred「plan/role 持久化」的角色部分已落地：

- **新增 `repositories/sql_models.py`**：`RoleORM`（表 `orchestrator_roles`，复合主键 `(tenant_id, role)`，capabilities JSON）。
- **新增 `repositories/sql_store.py`**：`SqlRoleStore`（save/delete/load）。`MATE_DB_URL`/`DATABASE_URL` 设置时持久化；无 DSN（dev/test）no-op 保持内存。
- **`RoleRegistry` 接入 store**：`register()`/`unregister()` 镜像持久化，`restore()` 启动恢复（幂等）；持久化失败仅告警不阻断运行时。
- **main.py**：`create_app()` 启动时 `registry.restore()`。
- **测试**：`tests/test_role_persistence.py` 4 用例（roundtrip 恢复、unregister 持久化、restore 幂等、无 DSN 禁用）。
- plan 状态持久化仍 **deferred**（对齐 SESSION-01，与 kernel `SuperAIOrchestrator` 内存态一致）。
- orchestrator 全量 **26 passed**（22 + 4）；合并套件 **241 passed**。

## 10. A3 补充：copilot 编排入口吸收 phase-1（2026-08-12）

蓝图 A3 收尾第一步 —— **orchestrator 接管 copilot 的 `scheduling/*` 编排入口**（用真实机制替代 copilot 的薄 stub）：

- **新增 `api/scheduling.py`**：8 端点 —— intent/detect、employees/match（token 匹配 role capabilities）、plan/generate（构建步骤 + 经 plan runner 提交，含 HITL 步）、execution/start（plan runner 执行）、execution/{id}/report、intents、templates GET/POST。形状对齐前端 `api/superai/schedule.ts`。
- **dispatcher 增强**：`_resolve_by_rid` 支持裸角色 slug（如 "knowledge"）直接命中，否则走 AgentSelector rid 前缀。
- **plan_runner 增强**：`_dispatch_step` 改为实时 `get_dispatcher()`（DI/set_dispatcher 一致）。
- **copilot 弃用**：6 个 scheduling 处理器加 `Deprecation`/`X-Sunset`/`X-Migrated-To` 头；`copilot.yaml` 6 个 scheduling 操作标 `deprecated: true`。copilot 路由仍可用（不回退）。
- **前端**：`api/superai/schedule.ts` base 从 copilot 切到 `/api/v1/orchestrator`。
- **契约**：orchestrator.yaml 新增 8 个 scheduling 操作（共 17 ops）。
- **测试**：`tests/test_scheduling.py` 3 用例（intent/match、plan/execute、templates）；orchestrator 全量 **29 passed**；快速包合并 **644 passed**；tsc 干净。
- **边界**：copilot 的 chat/actions/generate/analysis/conversations（SuperAI 对话特性）**留在 copilot**，后续 Pi Agent 批次再迁；copilot `test_llm_adv_copilot.py` 6 个失败为既有环境性失败（LLM stub 安全规则），与本批次无关。
