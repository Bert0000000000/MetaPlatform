# P3-W9 LLMGW 业务深化 — cache/quota/cost 接入 chat + 管理 API 验收

> **验收日期**: 2026-08-01
> **批次**: P3-W9（BUSINESS-SLICES llmgw 业务深化）
> **范围**: llmgw cache/quota/cost 三模块接入 chat 主路径 + 4 个管理 API endpoint
> **关联 ADR**: ADR-0014（5 步接入）/ ADR-0016（BUSINESS-SLICES）
> **关联 PRD**: PRD-TECH-LLMGW
> **状态**: ✅ **Accepted**

---

## 1. 改动清单

| 文件 | 改动 | 关键能力 |
|---|---|---|
| `router.py` | chat() 主路径接入 | cache 命中跳过 provider + quota 超限 429 + cost 记录用量 |
| `cache/llm_cache.py` | 扩展 | cache_key 加 tenant_id + LLMCache.stats() + clear_tenant() |
| `quota/bucket.py` | 扩展 | RedisTokenBucket.status() 返回 RPM/TPM used/limit |
| `cost/recorder.py` | 扩展 | 内存记录 + CostRecorder.summary() 返回 by_model |
| `api/routes.py` | 新增 | ChatRequest 加 tenant_id + 4 管理 endpoint + HTTPException 透传 |
| `tests/test_llmgw_business.py` | 新建 | 11 tests |

---

## 2. 新增管理 API

| Endpoint | 方法 | 用途 |
|---|---|---|
| `/api/v1/llmgw/cache/stats` | GET | 缓存命中率 (hits/misses/hit_rate) |
| `/api/v1/llmgw/cache/{tenant_id}` | DELETE | 清除某租户缓存 |
| `/api/v1/llmgw/quota/{tenant_id}` | GET | 配额状态 (RPM/TPM used/limit) |
| `/api/v1/llmgw/usage/{tenant_id}` | GET | 成本摘要 (total_tokens/total_cost/by_model) |

---

## 3. 测试结果

```text
$ python -m pytest mate-platform-backend/packages/mate-tech-llmgw/tests -q --tb=short
80 passed in ~3s   # 0 failed / 0 skipped

# 新增 11 tests 逐项确认
$ python -m pytest mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_business.py -v
11 passed in 1.0s
```

### 3.1 测试明细

| 测试 | 断言要点 |
|---|---|
| `test_chat_returns_cached_response_on_second_call` | 第二次调用命中缓存，provider 仅调用 1 次 |
| `test_chat_records_cost_after_provider_call` | provider 调用后 CostRecorder.summary() 有 token + cost |
| `test_chat_rejects_when_quota_exceeded` | QuotaExceededError → HTTPException 429 |
| `test_cache_miss_when_different_tenant` | 租户 A/B 相同 prompt 不共享缓存 |
| `test_cache_stats_endpoint` | GET /cache/stats 返回 hits/misses/hit_rate |
| `test_cache_stats_endpoint_no_cache` | 无 cache 实例时返回 enabled=false |
| `test_cache_clear_endpoint` | DELETE /cache/{tenant} 清除指定租户，保留其他租户 |
| `test_quota_status_endpoint` | GET /quota/{tenant} 返回 RPM/TPM used/limit |
| `test_quota_status_endpoint_no_bucket` | 无 bucket 时返回 enabled=false |
| `test_usage_endpoint` | GET /usage/{tenant} 返回 total_tokens/total_cost/by_model |
| `test_usage_endpoint_no_recorder` | 无 recorder 时返回空摘要 |

---

## 4. 降级策略

cache/quota/cost 三模块在无 Redis/PG 的测试环境:
- 单例默认为 `None`，chat() 检测到 `None` 直接跳过（no-op）
- 所有 Redis/PG 操作 try/except 包裹，失败只 log.warning 不影响主路径
- 管理 API 在无单例时返回 `enabled: false` + 默认零值

---

## 5. 13 硬规则合规

| # | 硬规则 | 合规 |
|---|---|---|
| 3 | 没有 tenant 上下文不访问 repository | ✅ cache_key 含 tenant_id，隔离验证通过 |
| 9 | 审计、指标、trace | ✅ structlog 在 cache hit/miss/quota/cost 各路径有日志 |
| 10 | 所有状态以验收证据为准 | ✅ 本文件 |

---

> **结论**: P3-W9 LLMGW cache/quota/cost 接入 chat 主路径 + 管理 API 全部交付，11 tests pass，0 regression。**Accepted**。
