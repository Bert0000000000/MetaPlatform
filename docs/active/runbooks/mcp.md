# mate-tech-mcp Runbook

## 概述

Mate Platform MCP（Model Context Protocol）服务 — 工具 / 资源 / 提示的统一桥接。

## 启动

```bash
cd packages/mate-tech-mcp
uv run --package mate-tech-mcp python -m mate_tech_mcp.main
# 或指定 transport
MCP_TRANSPORT=stdio uv run --package mate-tech-mcp python -m mate_tech_mcp.main
MCP_TRANSPORT=sse uv run --package mate-tech-mcp python -m mate_tech_mcp.main  # 默认
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查（含 tool 数） |
| GET | /api/v1/mcp/tools | 工具列表 |
| GET | /api/v1/mcp/resources | 资源列表 |
| GET | /api/v1/mcp/prompts | 提示模板列表 |
| POST | /api/v1/mcp/prompts/{name} | 渲染 prompt |
| POST | /api/v1/mcp/tools/{name} | HTTP 桥接调工具 |

## 内置工具

- `kb_search(query, top_k, kb_ids)` — 调 tech-rag `/api/v1/rag/search`

## 内置资源

- `ontology://{class_id}` — 调 tech-ont `/api/v1/ont/classes/{id}`

## 内置 Prompt 模板

- `summarize_doc(document)` — 文档总结
- `extract_entities(text)` — 实体抽取
- `plan_task(task, tools)` — 任务规划

## OAuth 集成

所有 `/tools/{name}` 端点要求 `Authorization: Bearer <jwt>`。

无 token → 401；过期 token → 401；错误 issuer → 401。

## 限流

每租户每工具 50 req/min（Redis 滑动窗口）。超限 → 429 + Retry-After。

## 故障排查

| 现象 | 排查 |
|---|---|
| 工具 404 | 检查 `mcp_server.register_tool()` 是否调用 |
| 401 | 检查 JWT 是否有效 + 过期 |
| 429 | 检查 `ToolRateLimiter` 配置 |
| 资源 404 | 检查 ontology 服务连接 |

## SLO 越线（ADR-0018 §2.1）

### Tool deny spike

**触发**：`MCPToolDenySpike`（任意工具在 5min 内出现 1 次 deny）

1. 打开 Grafana `MCP Tool Deny Rate by Tenant` dashboard。
2. 同步检查 `mate_platform_tenancy_cross_tenant_attempt_total`：
   若两者同步上涨 → 是越权攻击（P0 阻断）；若只有 tool deny →
   是租户工具配额触发（429 retry_after 内会自动重置）。
3. 看 trace `mcp.tool.{name}` span 的 `tenant.id` / `user.id`，定位调用方。
4. 攻击情形：联系 Security oncall 走 SIEM 流程；配额情形：发租户 admin 邮件说明。

### Federation upstream 错误

（占位：federation 越权 / 未授权 upstream 触发 `MCPToolDenySpike` 走同一路径。）