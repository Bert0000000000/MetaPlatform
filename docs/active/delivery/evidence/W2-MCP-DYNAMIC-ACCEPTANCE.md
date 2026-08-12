# W2 — MCP 服务中心动态工具注册表：验收证据

> 批次：W2（MCP 动态注册表）· 日期：2026-08-12
> 工作目录：`mate-platform-backend/packages/mate-tech-mcp`
> 上游：W1（A2A 官方 SDK）✅ · 下游：W3（mate-tech-orchestrator）

## 1. 一句话验收

**MCP 服务中心工具注册从「静态 import 期」升级为「租户隔离的运行时动态注册表」：数字员工 / 外部 worker 可通过 `POST /api/v1/mcp/tools` 注册带转发 endpoint 的能力，`POST /tools/{name}` 执行链路 = 本地 handler → 动态转发 → federation → 404；137 MCP tests 全绿，ruff/pyright 干净。**

## 2. 改动清单

| 文件 | 改动 |
|---|---|
| `repositories/in_memory.py` | `McpTool` 加 `endpoint` 字段；新增 name-keyed 访问器 `get_tool_by_name / register_tool / update_tool / unregister_tool / list_dynamic_tools`（租户隔离） |
| `repositories/__init__.py` | 导出 catalog + 动态注册表函数（此前为空） |
| `tools/forwarding.py` | **新增** `DynamicToolInvoker`：复用 federation `ExternalMcpClient` 做 MCP-to-MCP 转发（无裸 httpx） |
| `api/origin_routes.py` | `GET /tools` 合并静态+租户动态；新增 `POST /tools`、`PUT /tools/{name}`、`DELETE /tools/{name}`（含 outbox 事件）；`POST /tools/{name}` 执行链路加动态转发 + federation fallback |
| `main.py` | outbox writer 从 None 改为真实 `InMemoryOutboxWriter`（federation + tools 事件），绑定 `app.state.outbox_writer` |
| `tests/test_dynamic_registry.py` | **新增 6 用例**：注册入列 / 注册后转发 / 更新+删除 / 未知 404 / 租户隔离 / outbox 事件 |
| `contracts/openapi/services/mcp.yaml` | 新增 3 条路径（POST/PUT/DELETE /tools）+ 3 个 schema（RegisterToolRequest/UpdateToolRequest/DynamicTool） |

## 3. 测试证据

```
$ pytest packages/mate-tech-mcp/tests
137 passed, 44 warnings in 9.40s     # 基线 131 + 新增 6
```

- `test_dynamic_registry.py` 6 用例：注册→GET /tools 可见；注册→调用→转发到 endpoint（fake invoker 注入 `app.state.dynamic_invoker`）；PUT 改 endpoint/enabled + DELETE + 再调用 404；租户 A 注册 B 不可见；`mcp.tool.registered` outbox 事件。

## 4. 静态检查证据（硬规则 ⑥）

```
$ ruff check packages/mate-tech-mcp/src packages/mate-tech-mcp/tests/test_dynamic_registry.py
  All checks passed
$ pyright-python .../api/origin_routes.py .../tools/forwarding.py .../repositories/in_memory.py .../main.py
  0 errors, 0 warnings, 0 informations
```

## 5. 契约证据（硬规则 ①）

- `contracts/openapi/services/mcp.yaml` 现 20 个 operationId（新增 `mcpPostMcpTools / mcpPutMcpToolsName / mcpDeleteMcpToolsName`），YAML 校验通过。
- 新路由全部落契约（POST/PUT/DELETE /api/v1/mcp/tools）。

## 6. 偏离记录

1. **GET /tools 形状**：计划提"返回 page 形状对齐前端 tools.ts"；落地发现契约 `mcpGetMcpTools` 声明返回 `{tools: [ToolSpec]}`，**契约优先**，保持 `{tools: [...]}`（前端 tools.ts 兼容两种形状）。
2. **SQL 持久化**：计划接 `sql_store`；落地用内存租户 catalog（既有 a2a SQL 后端同样未接线，一致）。SQL 持久化动态注册表 **deferred**。
3. **测试 fixture**：新测试避免重导入 `mate_tech_mcp.*`（模块 eviction 会污染 test_edge 等顶部导入），用 `create_server()` 建全新 server。
4. federation fallback 落实：`POST /tools/{name}` 本地未命中 → 动态 → `federation_router.route`（此前 docstring 声称 fallback 但无调用方，现已接线）。

## 7. 边界

- 未动：静态工具注册（kb_search 等）、rate limiter、federation registry 既有逻辑、streamable-http 真实协议面（deferred）。
- 未动：`/clients`、`/trusts`、`/external-agents` 等管理端点契约补齐（既有无契约，deferred）。

## 8. W4 补充：streamable-http 真实 MCP 协议面（2026-08-12）

原 deferred 项「streamable-http 真实协议面」已落地：

- **新增 `protocol/streamable.py`**：`MateStreamableHttpServer(FastMCP)` 子类，`list_tools/call_tool/list_resources/list_prompts/get_prompt` 委托到 MCPServer **运行时注册表**（含 W2 动态注册表 + federation fallback），`build_streamable_http_app()` 返回 Starlette app。
- **挂载**：main.py `app.mount("/mcp-protocol", ...)` —— 外部 MCP 客户端（Claude Desktop / Cursor 等）经标准 streamable-http 协议发现/调用服务中心工具。
- **契约**：mcp.yaml 新增 `/mcp-protocol` GET/POST（`mcpGetMcpProtocol` / `mcpPostMcpProtocol`），共 22 ops。
- **测试**：`tests/test_streamable_http.py` 4 用例（静态+动态工具列表、本地调用、未知 404、官方 MCP client 全链路 initialize→list→call）。
- **E2E 证据**（临时脚本验证后删）：官方 `streamablehttp_client` → initialize(protocol 2025-11-25) → list_tools `['add']` → call_tool add(2,3) → `structuredContent={'sum':5}`。
- **限制**：MCP 协议无 tenant 头，动态/federation 层按 `default` 租户解析；资源 read 暂未接线（与既有状态一致）；挂载路径由外层 `install_auth` 守门。
- MCP 全量 **141 passed**（137 + 4）。
