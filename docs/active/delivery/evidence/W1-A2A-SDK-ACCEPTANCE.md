# W1 — A2A 服务中心官方 SDK 替换：验收证据

> 批次：W1（A2A 官方 a2a-sdk 替换）· 日期：2026-08-12
> 决策：`docs/active/decisions/ADR-0030-a2a-official-sdk.md`
> 调研：`docs/active/reports/REPORT-MCP-A2A-开源组件调研-2026-08-12.md`
> 工作目录：`mate-platform-backend/packages/mate-app-a2a`

## 1. 一句话验收

**A2A 服务中心出站协议层由「手写 JSON POST」换成官方 `a2a-sdk`（A2A 1.0 JSON-RPC + Task artifacts 提取），入站 `/messages` 与 `/tasks/{task_id}` 统一返回契约声明的 W3C `A2ATask`；45 tests 全绿，ruff/pyright 干净，线上契约字节不变。**

## 2. 改动清单

| 文件 | 改动 |
|---|---|
| `packages/mate-app-a2a/pyproject.toml` | 依赖加 `a2a-sdk>=0.1.0` |
| `packages/mate-app-a2a/Dockerfile` | pip install 列表加 `a2a-sdk` |
| `src/mate_app_a2a/clients.py` | `ExternalAgentClient` 改用官方 SDK client（`create_client` + `send_message` + artifacts 提取），错误映射保持；新增 `client_factory` 测试注入缝 |
| `src/mate_app_a2a/api/app.py` | 新增 `A2ATaskStatus/A2AArtifact/A2ATask` 响应模型；`POST /messages`、`GET /tasks/{task_id}` 统一返回 `A2ATask`（`exclude_none` 保持字节不变） |
| `ruff.toml` | `mate_app_a2a/api/app.py` 加 N815 per-file ignore（W3C camelCase 字段，沿用既有惯例） |
| `tests/test_messages_envelope.py` | `GET /tasks/{task_id}` 断言更新为 A2ATask 形状 |
| `tests/test_a2a_protocol_client.py` | **新增 5 用例**：SDK task 提取 / message 文本传递 / 空消息 / 超时传播 / factory 错误映射 |

## 3. 测试证据

```
$ pytest packages/mate-app-a2a/tests -q
45 passed, 23 warnings in 0.77s     # 基线 40 + 新增 5
```

- `test_messages_envelope.py::test_messages_envelope_accepts_w3c_schema` —— 线上 JSON 字节不变（`status == {"state":"submitted"}`、`contextId`、`history[0].messageId`）。
- `test_a2a_protocol_client.py` 5 用例 —— 官方 SDK 出站路径（fake client factory 注入）。

## 4. 静态检查证据（硬规则 ⑥）

```
$ ruff check packages/mate-app-a2a/src packages/mate-app-a2a/tests/test_a2a_protocol_client.py
  仅剩既有问题（agent_registration.py ERA001 / delegate.py PLW0603，非本批次引入）
$ pyright-python packages/mate-app-a2a/src/mate_app_a2a/clients.py packages/mate-app-a2a/src/mate_app_a2a/api/app.py
  0 errors, 0 warnings, 0 informations
```

## 5. 契约证据（硬规则 ①）

- `contracts/openapi/services/a2a.yaml` 本就声明 `POST /messages` → `A2ATask`、`GET /tasks/{task_id}` → `A2ATask`；本批次实现对齐契约，**未改 a2a.yaml**。
- `GET /tasks/{task_id}` 修复契约漂移（此前返回内部 `DelegationTask` dict）。
- `contracts/openapi/generated/bundled.yaml` 过期（缺 4 条 a2a 路径）为**既有问题**，redocly 未安装，重新生成推后到集成阶段（ga-001 走 oasdiff 对拍 service yaml，不受 bundled 影响）。

## 6. 偏离记录

1. 计划原写"替换 envelope → SDK 类型"；落地发现 **a2a-sdk 核心类型为 protobuf**（`a2a.types.a2a_pb2`），非 pydantic，不能直接做 FastAPI 请求体。调整为：**入站保留 pydantic 契约模型**（契约 schema 即 W3C wire 格式），**出站协议层换官方 SDK client**（消除真正的手写协议成本）。
2. `GET /tasks/{task_id}` 返回形状改为 A2ATask（契约对齐），唯一消费方是测试本身（已同步更新）；前端调用的是 `/delegations/{taskId}`（后端本就不存在，属既有前端契约缺口，非本批次范围）。
3. 原生 A2A server 挂载（`add_a2a_routes_to_fastapi`）与 `bundled.yaml` 重生成 **deferred**，理由见 ADR-0030 §5。

## 7. 边界

- 未动：`/delegate`（deprecated）、`/external`、`/register`、`/agent-cards/search`、`/delegations`、`/tasks` 列表、DeerFlow 注册、SQL 后端接线（既有未接线状态）。
- 未动：`mate-app-copilot` 的 `/a2a/*` 代理（其调用 `/delegate`、`/external`，shape 未变）。
