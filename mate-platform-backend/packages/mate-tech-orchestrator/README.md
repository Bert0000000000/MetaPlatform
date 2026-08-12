# mate-tech-orchestrator

Multi-role digital-employee dynamic scheduling plane (蓝图 A3 编排层)。

把任务/计划派发给 MCP 服务中心（工具）与 A2A 服务中心（agent），
实现 7+N 数字员工的动态调度。

## 核心概念

- **角色（Role）**：kernel `AgentRole`（ontology/workflow/app/data_product/obs/security/knowledge/superai）。
  数字员工角色通过 `POST /api/v1/orchestrator/roles` 动态注册，能力绑定到 worker。
- **能力（Capability → worker）**：`worker_kind ∈ {mcp, a2a, http, local}`。
  - `mcp` → MCP 服务中心工具（`POST /api/v1/mcp/tools/{name}`）
  - `a2a` → A2A 服务中心消息（`POST /api/v1/a2a/messages`）
  - `local` → 本地执行（SuperAI / Pi Agent 对接点）
- **派发（Dispatch）**：`POST /api/v1/orchestrator/dispatch` —— 按 rid 前缀（kernel `AgentSelector`）
  或 capability 选角色，路由到 worker。
- **计划（Plan）**：`POST /api/v1/orchestrator/plans` —— 复用 kernel `SuperAIOrchestrator`；
  每步派发到角色；HITL 步（决策 B3 ≥1）暂停等审批，`review` 后继续。

## 路由

见 `contracts/openapi/services/orchestrator.yaml`。

## 本地运行

```bash
uv sync
uvicorn mate_tech_orchestrator.main:app --port 8505
```

## 硬规则对齐

- ① 所有路由落 `orchestrator.yaml`
- ③ 每个 handler `require_tenant` 后再碰 repo
- ④ 出站经 `mate-clients` ACL client（`McpToolsClient` / `A2AMessagesClient`）
- ADR-0014 step 3：写操作发 `orchestrator.*` outbox 事件
