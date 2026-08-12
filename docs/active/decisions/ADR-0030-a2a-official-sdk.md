# ADR-0030: A2A 服务中心采用官方 a2a-sdk（W1）

> 状态：**Accepted v1.0** · 日期：2026-08-12 · 决策人：MatePlatform Architecture Council
>
> 上游：`docs/active/reports/REPORT-MCP-A2A-开源组件调研-2026-08-12.md`（Star TOP3 调研）
> 关联：W1（A2A 官方 SDK 替换）/ W2（MCP 动态注册表）/ W3（mate-tech-orchestrator 编排层）

## 1. 背景

用户担心 A2A/MCP 自研成本过大，要求调研 GitHub Star TOP3 开源组件。调研结论（2026-08-12）：

- **A2A 无争议**：官方 `a2aproject/A2A`（25.3K 星，Apache-2.0）协议 + `a2aproject/a2a-python`（2.1K 星，Apache-2.0）Python SDK。
- 本项目现状 `mate-app-a2a` 的出站委派（`ExternalAgentClient`）是**手写 JSON POST**（`{message, context, tenant_id, trace_id}`），不是 A2A 协议；入站 envelope 为手写 pydantic（契约 schema，保留合理）。

用户决策（2026-08-12 两次确认）：技术路线 = 「官方 SDK + 自建加固」。

## 2. 决策

**A2A 服务中心采用官方 `a2a-sdk`（`a2a-sdk>=0.1.0`，实测 1.1.2）**，落点为**出站协议层**：

1. **出站**：`ExternalAgentClient` 内部改用官方 SDK client（`a2a.client.create_client` + `send_message`），真正走 A2A 1.0 协议（agent-card 发现 + JSON-RPC 消息发送 + Task artifacts 提取），替代手写 JSON POST。公开接口 `call(endpoint, payload, ...)` 与返回 shape 不变，delegator 与既有测试不受影响。
2. **入站**：`POST /api/v1/a2a/messages` 与 `GET /api/v1/a2a/tasks/{task_id}` 统一返回**契约声明的 W3C `A2ATask`**（修复此前 `GET /tasks/{task_id}` 返回内部 `DelegationTask` dict 的契约漂移）。入站 envelope 保留 pydantic 契约模型（FastAPI 请求体需要 pydantic，且线上字段名 `messageId/role/parts/contextId/taskId/status.state` 为 W3C 协议规定，字节不可变）。

**关键认知（落地中发现，记录备查）**：`a2a-sdk` 核心类型是 **protobuf 生成**（`a2a.types.a2a_pb2` 的 `Message/Part/TaskStatus`），非 pydantic 模型，不适合直接作为 FastAPI 请求/响应体；故入站保留 pydantic 契约模型（契约 schema 本身就是 W3C 定义的 wire 格式，非"自研协议"），协议正确性由官方 SDK client 在出站侧保证。

## 3. 实施细节

- 依赖：`packages/mate-app-a2a/pyproject.toml` + `Dockerfile` 加 `a2a-sdk`。
- `clients.py`：`ExternalAgentClient` 用 `a2a.client`（`ClientConfig(streaming=False)`）替换裸 httpx；错误映射保持（超时 → `httpx.TimeoutException` 传播，其他 → `httpx.HTTPError`，delegator 映射 timeout/failed）。
- `api/app.py`：新增 `A2ATaskStatus/A2AArtifact/A2ATask` 响应模型 + `_task_state_name/_task_to_a2a_task` 映射；`POST /messages`、`GET /tasks/{task_id}` 加 `response_model=A2ATask, response_model_exclude_none=True`（保持线上字节不变）。
- 测试：新增 `tests/test_a2a_protocol_client.py`（5 用例，注入 fake SDK client factory）；更新 `test_messages_envelope.py` 断言 A2ATask 形状。

## 4. 验收

- `pytest packages/mate-app-a2a/tests`：**45 passed**（基线 40 + 新增 5）。
- ruff（`ruff check`）与 pyright（`pyright-python`）对改动文件 0 错误（新增 `ruff.toml` N815 per-file ignore，W3C camelCase 字段）。
- 线上契约字节不变：`test_messages_envelope.py` 断言 `status == {"state": "submitted"}`、`contextId`、`history[0].messageId` 原样。

## 5. 影响

- **正向**：出站委派从"自研协议"改为官方维护协议（A2A 1.0 JSON-RPC + artifacts 提取），自研成本显著下降；`GET /tasks/{task_id}` 契约对齐（OpenAPI 单一契约源）。
- **负面/风险**：SDK 依赖 protobuf（`protobuf>=6.33.6`）；真实外部 agent 需暴露 A2A agent-card（`/.well-known/agent.json`）才能被出站客户端调用——未暴露的 agent 调用将走 `failed` 分支（行为正确，非回归）。
- **后续**：原生 A2A server 面（`add_a2a_routes_to_fastapi` 挂载，供外部 A2A 客户端发现本中心）**deferred**（W1 聚焦出站协议 + 契约对齐）；SDK 类型非 pydantic 的结论已记录。

## 6. 备选方案

- **A. 入站也换 SDK 类型**（拒绝：SDK 类型为 protobuf，FastAPI 请求体需要 pydantic；线上字段名 W3C 规定不可改）
- **B. 出站继续手写 JSON POST**（拒绝：即"自研协议"，正是本 ADR 要消除的成本）
- **C. 整体引入 ContextForge**（拒绝：430MB 大仓、自带 RBAC/DB 模型与 13 硬规则冲突，见调研报告）

## 7. 参考

- `docs/active/reports/REPORT-MCP-A2A-开源组件调研-2026-08-12.md`
- `packages/mate-app-a2a/src/mate_app_a2a/clients.py`
- `packages/mate-app-a2a/src/mate_app_a2a/api/app.py`
- `contracts/openapi/services/a2a.yaml`（A2ATask 定义）
- `a2aproject/a2a-python`（Apache-2.0）
