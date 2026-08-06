# mate-tech-llgw Runbook (ST-5.5.12.2 + ST-5.5.12 final)

## 概述

Mate Platform LLM Gateway 负责多 provider LLM 路由、配额、缓存、安全。

## 启动

```bash
# Mock 模式（无需后端）
API_MODE=mock pnpm dev  # via BFF
# 或直接启动 llmgw：
cd packages/mate-tech-llmgw
uv run --package mate-tech-llmgw python -m mate_tech_llmgw.main
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| POST | /api/v1/llm/chat | 同步 chat |
| POST | /api/v1/llm/chat/stream | SSE 流式 chat |
| POST | /api/v1/llm/embeddings | 嵌入向量 |

## 配额（Quota）

每租户 50 req/min + 50k tokens/min（Redis 滑动窗口）。

超限 → 抛 `RateLimitExceeded` → HTTP 429 + `Retry-After` 头。

## 缓存

key = `sha256(model + temperature + messages + extra)`。

temperature=0 强制 cache-first 路径。命中 → 直接返回。

## 成本（Cost）

`PRICING` 表覆盖 7 个 model：
- OpenAI: gpt-4o / gpt-4o-mini / gpt-4-turbo / gpt-3.5-turbo
- Anthropic: claude-3-5-sonnet / claude-3-opus / claude-3-haiku

每次 chat 记录 → `llm_usage` PG 表（需 asyncpg pool）。

## 安全（Security）

敏感字段送 LLM 前自动打码：
- `phone_cn` (1[3-9]\d{9})
- `id_card_cn` (\d{17}[\dXx])
- `email`
- `credit_card`
- `ip_v4`

## 故障排查

| 现象 | 排查 |
|---|---|
| 5xx > 1% | 检查 provider API key + 网络 |
| 429 高 | 检查 `LLMGW_RPM_LIMIT` env |
| 缓存不命中 | 检查 `temperature > 0` |
| PII 未脱敏 | 检查 `security/pii_mask.py` 加载 |

## SLO 越线（ADR-0018 §2.1）

> 首次 SLO 越线排查：永远先看 trace、再看 quota、最后看 provider 日志。

### RAG TTFT 越线

**触发**：`RagTTFTLocalP95TooHigh`（p95 > 1.5s 持续 3m）

1. 打开 Grafana `RAG Retrieval Latency` dashboard，按 `tenant_id` 切片。
2. 切到 Tempo trace `service.name=mate-tech-rag`，筛选 `rag.retrieve` span，
   看 `rag.retrieve.latency_ms` 字段定位是 hybrid / graph / lightrag 哪个策略耗时。
3. 看 `cache_hit_ratio{strategy=...}` 指标，若命中率 < 70% → 检查 embedding
   cache 是否过期或上游 provider 限流。
4. 必要时切换 `RAG_DEFAULT_MODE=graph` 或扩容 vector store。
5. 仍不能恢复 → oncall SRE 升级。

### Copilot 错误率越线

**触发**：`CopilotChatErrorRateTooHigh`（error rate > 5% 持续 5m）

1. 打开 dashboard `Copilot Outcome by Tenant`，按 outcome=error 切片。
2. 在 Tempo 过滤 `copilot.invoke` span，`outcome=error` 的链路。
3. 子 span 异常定位：tool.execute vs llmgw.chat vs rag.retrieve。
4. 若是 tool.execute → 看 MCP 工具注册；若是 llmgw.chat → 看 provider API key；
   若是 rag.retrieve → 走 RAG TTFT 越线处理。
5. 升级路径：copilot oncall → platform oncall。

### Monthly Quota

**触发**：`LLMGWMonthlyQuotaExceeded`（任意租户当月累计 token 撞上限）

1. 查 `llmgw_tenant_quota` 表（PG）确认 `tokens_used` / `tokens_limit`。
2. 已自动下发 429 + `Retry-After: 86400`。
3. 若租户合法诉求高 → 临时调高 `LLMGW_MONTHLY_TOKEN_LIMIT` env；
   若异常突发 → 检查是否 denial-of-wallet（看 cost_anomaly_total）。
4. 不要在告警触发 1h 内降低上限，避免业务峰谷误伤。

### Cost abuse / Denial-of-wallet

**触发**：`scan_for_anomalies` 返回 `CostAnomaly(multiplier >= 10x)`

1. 看 `mate_platform_llmgw_cost_anomaly_total{user_id=...}`。
2. 临时封禁：在 `mate_llmgw_user_quarantine` 表 INSERT (user_id, until)。
3. 联系租户 admin 确认是否账户泄露。