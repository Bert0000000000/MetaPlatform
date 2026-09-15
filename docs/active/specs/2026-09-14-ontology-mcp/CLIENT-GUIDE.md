# 外部 AI 客户端接入指南 — 本体引擎 MCP 服务

> 面向：想把 Mate Platform 本体引擎（Ontology）能力接入自家 Agent 的外部 AI 客户端 —— Claude Code、Codex、Cursor 及一切支持 MCP 的客户端。
>
> 文档版本：2026-09-14。工具清单以服务端 `tools/list` 实际返回为准（平台正在持续追加工具，见 §4 末尾「平台扩展中」）。

## 1. MCP 是什么（一句话）

MCP（Model Context Protocol）是一个开放协议，让 AI 客户端以标准方式发现并调用外部服务暴露的工具（tools）、资源（resources）、提示模板（prompts）—— 客户端不用为每个服务写定制集成，服务端不用为每个客户端适配协议。

## 2. 端点与鉴权

| 项 | 值 |
| --- | --- |
| 协议 | MCP **streamable-http** transport（官方 Python SDK `FastMCP.streamable_http_app()` 挂载） |
| 端点 | `http://localhost:8100/api/v1/mcp/protocol/mcp`（经 API 网关 8100；服务本体 `mate-tech-mcp:8081` 同路径） |
| 鉴权 | `Authorization: Bearer <JWT>`，由平台 IAM 登录颁发（RS256） |
| 身份语义 | **token 即身份**：token 对应哪个用户/租户，工具调用就以该身份执行 |

### 2.1 获取 token

```bash
# 登录（默认开发账号，生产环境请使用自己的账号）
curl -s http://localhost:8100/api/v1/iam/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# → {"accessToken":"<JWT>","tokenType":"Bearer",...}

# 存进环境变量，后续所有配置都用它
export MATE_MCP_TOKEN="<accessToken>"
```

PowerShell 等价写法：

```powershell
$resp = Invoke-RestMethod -Method Post -Uri "http://localhost:8100/api/v1/iam/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}'
$env:MATE_MCP_TOKEN = $resp.accessToken
```

token 有时效，过期（401）后重新登录获取即可。

### 2.2 连通性验证（可选，raw curl）

streamable-http 就是 POST JSON-RPC；响应为 SSE（`text/event-stream`，`data:` 行里是 JSON-RPC 结果）。三步冒烟：

```bash
# ① initialize —— 注意 -i 看响应头，取 Mcp-Session-Id
curl -si http://localhost:8100/api/v1/mcp/protocol/mcp \
  -H "Authorization: Bearer $MATE_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-smoke","version":"0.0.1"}}}'
# 响应头形如:  mcp-session-id: <SESSION_ID>

# ② initialized 通知（无 id、无响应体）
curl -s http://localhost:8100/api/v1/mcp/protocol/mcp \
  -H "Authorization: Bearer $MATE_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# ③ 列工具
curl -s http://localhost:8100/api/v1/mcp/protocol/mcp \
  -H "Authorization: Bearer $MATE_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

三个请求都正常返回即接入就绪。日常使用不需要手写 curl —— 用下面各客户端的配置。

## 3. 各客户端接入

### 3.1 Claude Code（原生支持 http transport，推荐）

**方式 A：CLI 一行注册**

```bash
claude mcp add --transport http mate-ontology \
  http://localhost:8100/api/v1/mcp/protocol/mcp \
  --header "Authorization: Bearer $MATE_MCP_TOKEN"
```

- `--header` 语法为 `"Name: Value"`（冒号分隔）。
- 默认 scope 为 `local`（仅当前项目、当前用户）；加 `--scope project` 写入项目级 `.mcp.json`（见方式 B），加 `--scope user` 全局可用。
- 验证：`claude mcp list` / `claude mcp get mate-ontology`；会话内 `/mcp` 面板可看连接状态与工具列表。

**方式 B：项目级 `.mcp.json`**（放在仓库根目录，随项目共享；建议配合 `${VAR}` 环境变量展开，避免 token 进 git）

```json
{
  "mcpServers": {
    "mate-ontology": {
      "type": "http",
      "url": "http://localhost:8100/api/v1/mcp/protocol/mcp",
      "headers": {
        "Authorization": "Bearer ${MATE_MCP_TOKEN}"
      }
    }
  }
}
```

> `${MATE_MCP_TOKEN}` 由 Claude Code 启动时从环境变量展开（`${VAR}` 与 `${VAR:-default}` 均支持）。参考：[Claude Code MCP 文档](https://docs.claude.com/en/docs/claude-code/mcp)。

### 3.2 Codex / OpenAI（新版原生支持 streamable HTTP）

在 `~/.codex/config.toml`（或受信项目的 `.codex/config.toml`）中添加：

```toml
[mcp_servers.mate-ontology]
url = "http://localhost:8100/api/v1/mcp/protocol/mcp"
bearer_token_env_var = "MATE_MCP_TOKEN"
```

要点：

- streamable HTTP server 用 `url` 字段声明，**没有** `type`/`transport` 字段——不要同时写 `command` 与 `url`，属配置错误。
- `bearer_token_env_var` 填**环境变量名**（不是 token 本身）：Codex 启动时读取该变量并作为 `Authorization: Bearer ...` 头发送。
- 额外可调项（按需）：`startup_timeout_sec`（默认 10）、`tool_timeout_sec`（默认 60）。
- 验证：`codex mcp list`（会分别列出 stdio 与 streamable HTTP 两张表）。

> 旧版 Codex CLI 仅支持 stdio transport；若你的版本不认 `url` 字段，改用本文 §5 的 stdio 桥接脚本。字段细节以官方文档为准：[Codex MCP 配置](https://developers.openai.com/codex/mcp/)。

### 3.3 Cursor（原生支持 streamable URL + headers）

项目级 `.cursor/mcp.json` 或全局 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "mate-ontology": {
      "url": "http://localhost:8100/api/v1/mcp/protocol/mcp",
      "headers": {
        "Authorization": "Bearer <accessToken>"
      }
    }
  }
}
```

> 已知坑（以 Cursor 论坛反馈为准）：
> - `${env:VAR}` 插值在部分版本对 headers 不生效，token 请直接写值并注意不要提交到 git；
> - 若目标服务暴露 RFC 9728 OAuth 发现端点，Cursor 会忽略自定义 headers 强制走 OAuth —— 本平台 MCP 端点不暴露 OAuth 发现，不受影响。
>
> 参考：[Cursor MCP 文档](https://cursor.com/docs/mcp)。

### 3.4 其他客户端（通用）

任何支持 MCP **streamable-http**（又叫 "streamable HTTP" / "remote MCP"）transport 的客户端，配置三要素：

| 要素 | 值 |
| --- | --- |
| URL | `http://localhost:8100/api/v1/mcp/protocol/mcp` |
| Header | `Authorization: Bearer <accessToken>` |
| Accept | `application/json, text/event-stream`（SDK 会自动带，手工调协议时需要） |

只支持 stdio 的客户端见 §5 桥接方案。客户端支持矩阵可参考 [MCP 官方文档](https://modelcontextprotocol.io/clients)。

## 4. 工具清单（`ont_*` 命名空间）

下表入参列中 `*` 为必填（对应服务端 inputSchema 的 `required`）；详细 schema 以 `tools/list` 返回为准。

### 4.1 只读（agent 可自由调用）

| 工具 | 用途 | 入参要点 |
| --- | --- | --- |
| `ont_list_classes` | 列出租户可见的本体对象类型（含 marking），发现可查询的类型 | `markings`（可空）：逗号分隔的可见性过滤 |
| `ont_inspect_class` | 查看类型元数据：属性（格式/类型）、可遍历 link、绑定动作 | `class_rid*`：ObjectType rid |
| `ont_object_query` | 结构化 IR 查询本体对象，返回 `{kind, rows, result_schema}` | `source*`：ObjectType rid；可选 `filters[]` / `aggregation{}` / `traversal[]` / `sort[]` / `paging_limit` / `paging_offset` |
| `ont_preview_proposal` | 渲染 pending proposal 预览（kind / action_type / impact_summary / expected_diff 等）；非 pending 状态返回 409 | `proposal_id*` |

### 4.2 写提议（agent 可调 —— 只产生 proposal，不落库）

| 工具 | 用途 | 入参要点 |
| --- | --- | --- |
| `ont_propose_model_type` | AI 辅助建模（kind=model_type）：依文本生成 ObjectType 定义 → pending proposal | `name*` 显示名；`slug*`（拼进 rid）；`impact_summary*` 人类可读影响摘要；可选 `domain`、`properties[]`（Property 定义列表）、`primary_key[]` |
| `ont_propose_instance` | 从文本抽取的字段提议新建实例（kind=create_instance） | `class_rid*` 目标类型；`fields*`（属性 slug → 值）；`impact_summary*`；可选 `expected_diff` |
| `ont_merge_objects` | 提议合并两个 ObjectType（kind=merge_suggestion）：source → target 重映射 + 软删 source | `source_rid*` 被合并方；`target_rid*` 保留方；`impact_summary*`；可选 `mapping`（source 属性 → target 属性）、`similarity`（0-1） |

三个 propose 工具均返回 `ProposalResponse`（含 `proposal_id` / `expected_diff` / `kind`）。**AI 提案自动带溯源 provenance（`source=ai`）**，含来源/置信度/执行链，事后可审计。

### 4.3 HITL 边界（agent 不可调用）

| 工具 | 用途 | 边界 |
| --- | --- | --- |
| `ont_confirm_proposal` | pending → confirmed（用户确认） | 仅用户侧：平台前端「提案中心」确认/拒绝按钮，或用户侧路由。外部 Agent 直接调用会被服务端注册中心拒绝（`agent_invokable=False` 门禁） |
| `ont_reject_proposal` | pending → rejected（用户拒绝） | 同上 |
| `ont_execute_proposal` | confirmed → applied（落库执行） | 同上。外部 Agent 不能跳过 confirm 直接 execute |

**标准工作流**：agent `propose_*` → （用户查看 `ont_preview_proposal` 或 UI）→ **用户** confirm → **用户侧** execute 落库。agent 的职责止步于 propose + preview。

### 4.4 平台扩展中（上线后以 `tools/list` 为准）

以下工具平台正在追加（本指南落稿时尚未在所有环境可用）：

- `ont_list_individuals` —— 列实例，支持 Interface 多态源
- `ont_search_objects` —— 对象搜索
- `ont_validate_preflight` —— SHACL × Axiom 干跑校验（提交 proposal 前预检）
- `ont_agent_metrics` —— Agent 回归指标（proposal 接受率/趋势）

## 5. stdio 桥接（给只支持 stdio 的客户端）

仓库提供现成桥接脚本 [`scripts/mcp/mate-ont-mcp-stdio.py`](../../../scripts/mcp/mate-ont-mcp-stdio.py)：本地起 stdio MCP server，把 tools/resources/prompts 请求透传到远程 streamable-http 端点。仅依赖官方 `mcp` Python SDK（`pip install "mcp>=1.2"`）。

```bash
export MATE_MCP_URL="http://localhost:8100/api/v1/mcp/protocol/mcp"
export MATE_MCP_TOKEN="<accessToken>"
python scripts/mcp/mate-ont-mcp-stdio.py
```

只支持 stdio 的客户端（如旧版 Codex CLI）这样配：

```toml
[mcp_servers.mate-ontology]
command = "python"
args = ["D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/scripts/mcp/mate-ont-mcp-stdio.py"]
env = { MATE_MCP_URL = "http://localhost:8100/api/v1/mcp/protocol/mcp", MATE_MCP_TOKEN = "<accessToken>" }
```

详细用法与行为说明见脚本顶部 docstring。

## 6. 安全注意事项

1. **token 即身份**。`accessToken` 等同于登录态，持 token 者可以该用户身份调用全部工具与数据。不要硬编码进代码、不要提交进 git；项目级配置用环境变量展开（Claude Code 支持 `${VAR}`，Codex 用 `bearer_token_env_var`，Cursor 直接写值则务必本地化该文件）。
2. **AI 永不直写**。所有写操作只能走 `propose_*` → 用户 confirm → 用户侧 execute 的 proposal 状态机；`ont_confirm/reject/execute_proposal` 是 HITL 边界，外部 Agent 调用会被服务端拒绝。任何「agent 直接落库」的需求都不被本端点支持。
3. **提案可审计**。AI 产生的 proposal 自动携带 provenance（`source=ai`，含来源/置信度/执行链），confirm 前请用户阅读 `impact_summary` / `expected_diff`（可用 `ont_preview_proposal` 渲染）。
4. **登录态有时效**。token 过期返回 401，重新登录换新 token 并更新客户端配置（stdio 桥场景需重启桥进程）。
5. **租户隔离**。工具按 token 所属租户过滤数据；跨租户访问受平台 5 层隔离约束，越权调用返回错误。
