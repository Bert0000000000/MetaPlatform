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