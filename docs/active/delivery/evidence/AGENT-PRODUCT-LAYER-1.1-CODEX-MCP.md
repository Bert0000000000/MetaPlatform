# AGENT-PRODUCT-LAYER-1.1 · Codex 接入 MCP 中心（证据）

> 日期：2026-09-16 · 批次：feat/agent-product-layer-1.1 · 任务 2
> 决策依据：D-1（首个外部客户端 = Codex）、D-5（协议面按认证到的租户解析）
> 环境：Codex CLI `0.145.0`（`@openai/codex`，npm 全局）· MCP 中心 `localhost:8081`
> 经网关 `localhost:8100` 接入 · 租户 `tenant-default`

## 1. 配置（`~/.codex/config.toml` 片段）

```toml
[mcp_servers.mate-ontology]
# Mate Platform MCP 中心（1.1）。外部客户端经 streamable-http 接入；
# 协议面按**认证到的调用方**解析租户（sk-mcp-* 长期密钥或用户 JWT），
# 工具面随之按租户过滤 —— 不存在「所有客户端看到同一份工具面」的旧行为。
url = "http://localhost:8100/api/v1/mcp/protocol/mcp"
# 令牌从环境变量读，不落盘（硬规则 12）。运行时：
#   set MATE_MCP_TOKEN=<sk-mcp-… 或 用户 JWT>
bearer_token_env_var = "MATE_MCP_TOKEN"
# 允许表：只放行这三个本体只读工具。未列出的一律不出现在 Codex 的工具面里
# —— 包括中心自己标了 agentInvokable=false 的人工闸门工具
# （ont_confirm_proposal / ont_reject_proposal / ont_execute_proposal）。
enabled_tools = ["ont_list_classes", "ont_inspect_class", "ont_object_query"]
# 拒绝表在允许表**之后**生效：即使某项误入允许表，这里也能再拦一次。
disabled_tools = ["ont_confirm_proposal", "ont_reject_proposal", "ont_execute_proposal"]
```

配置形状依据 `codex-rs/config/src/mcp_types.rs`：`url` + `bearer_token_env_var`
（streamable-http 的 Bearer 通道）；过滤 = `enabled_tools` 允许表 +
`disabled_tools` 拒绝表（拒绝表在允许表之后生效）。`codex mcp add --help`
也暴露了同名字段（`--url` / `--bearer-token-env-var`）。

解析确认：

```
$ codex mcp get mate-ontology
mate-ontology
  enabled: true
  enabled_tools: ont_list_classes, ont_inspect_class, ont_object_query
  disabled_tools: ont_confirm_proposal, ont_reject_proposal, ont_execute_proposal
  transport: streamable_http
  url: http://localhost:8100/api/v1/mcp/protocol/mcp
  bearer_token_env_var: MATE_MCP_TOKEN
  status: enabled   auth: Bearer token
```

## 2. 真实调用记录

驱动方式：`codex exec --skip-git-repo-check -m <model> "<指令>"`，仅提供
`MATE_MCP_TOKEN`（登录网关取得的用户 JWT）。

### 2.1 成功调用 —— `ont_list_classes`

```
$ codex exec -m gpt-5.6-luna "Call the MCP tool 'ont_list_classes' … report JSON keys, count, first three rid"
mcp: mate-ontology/ont_list_classes started
mcp: mate-ontology/ont_list_classes (completed)
codex
1. JSON keys: `count`, `classes`, `hint`
2. `count`: `47`
3. First three class `rid` values:
   ont.tenant-default.obj.crm.contract.v1
   ont.tenant-default.obj.crm.customer1789382475546.v1
   ont.tenant-default.obj.crm.customer1789382639028.v1
```

### 2.2 成功调用 —— `ont_object_query`

```
$ codex exec -m gpt-5.6-luna "Call ont_object_query with source='ont.tenant-default.obj.crm.contract.v1' and paging_limit=3 …"
mcp: mate-ontology/ont_object_query started
mcp: mate-ontology/ont_object_query (completed)
codex
Result JSON keys: `kind`, `rows`, `result_schema`.
Rows returned: `0`.
```

（0 行 = 该租户有 47 个对象**类型**、尚无 contract 实例；调用本身 200 成功。）

### 2.3 工具过滤 —— 越权工具被挡在 Codex 之外

```
$ codex exec -m gpt-5.6-luna "List every tool from mate-ontology by exact name; is ont_object_query / ont_confirm_proposal available?"
codex
Available tools from `mate-ontology`:
- mcp__mate_ontology__ont_inspect_class
- mcp__mate_ontology__ont_list_classes
- mcp__mate_ontology__ont_object_query

`ont_object_query`: Available as `mcp__mate_ontology__ont_object_query`.
`ont_confirm_proposal`: Not available.
```

中心静态面共 18 个工具（`kb_search` / `ont_merge_objects` / `ont_agent_metrics` /
`ont_confirm_proposal` …），Codex 只看得到 `enabled_tools` 里的 3 个 —— 允许表
生效；人工闸门工具 `ont_confirm_proposal` 双保险不可见（允许表未列 + 中心标
`agentInvokable=false`）。

## 3. 判据对照

| 判据 | 结果 | 证据 |
| --- | --- | --- |
| Codex 侧能列出我们的工具 | ✅ | §2.3 恰好 3 个 |
| 能成功调用一次 | ✅ | §2.1 `count=47`；§2.2 结构化行集 |
| 越权工具被过滤 | ✅ | §2.3 `ont_confirm_proposal` Not available |
| 配置与调用记录落档 | ✅ | 本文 |

## 4. 边界与已知限制

1. **本次 bearer 用的是用户 JWT**（登录网关取得），不是 `sk-mcp-*` 长期密钥。
   原因是 MCP 把调用方令牌透传给本体引擎时，`sk-mcp-*` 不是 JWT、下游无法验签
   （实测 401）。对 API-key 调用方，代理回落为「服务身份 + `X-Tenant-Id=<调用方
   租户>`」，但本体引擎要求该服务令牌带 `tenant_switch_enabled` scope 才认
   `X-Tenant-Id`；该 scope 全仓零注册（实测 403「tenant switching is not enabled
   for this caller」）。**给服务身份开跨租户代表权是一处安全边界决策**，未擅自
   开启，列为遗留项（见批次报告）。
2. Codex 模型面用的是 ChatGPT 账号支持的 `gpt-5.6-luna`；工作区默认的
   `gpt-6-astra` 要求更新版 Codex（CLI 0.145.0 下 400）。
3. 未经网关直连 `localhost:8081` 需要 `MCP_ALLOWED_HOSTS` 含带端口的
   `localhost:8081`（SDK 对 Host 精确匹配，否则 421），已在 docker-compose 补上。
