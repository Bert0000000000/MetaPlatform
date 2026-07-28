# W5-5 子任务卡（ST）：tech-llmgw（LLM 路由网关）

> **源任务卡**：[tasks-W5.md § W5-5](./2026-07-27-mate-platform-tasks-W5.md#w5-5-tech-llmgwllm-路由12-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S6（2026-09-14 ~ 2026-09-27）
> **里程碑**：M3 关键路径
> **ST 总数**：29（拆解自 12 个 TC） — 2026-07-28 完成 24 ST（83%）
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.5.1 apps/tech-llmgw 初始化（2 ST）](#tc-551-appstech-llmgw-初始化2-st)
- [TC-5.5.2 LangChain 集成（3 ST）](#tc-552-langchain-集成3-st)
- [TC-5.5.3 多 provider 路由（4 ST）](#tc-553-多-provider-路由4-st)
- [TC-5.5.4 限流与配额（3 ST）](#tc-554-限流与配额3-st)
- [TC-5.5.5 成本计量（2 ST）](#tc-555-成本计量2-st)
- [TC-5.5.6 重试与 fallback（2 ST）](#tc-556-重试与-fallback2-st)
- [TC-5.5.7 流式 SSE（2 ST）](#tc-557-流式-sse2-st)
- [TC-5.5.8 Function calling（3 ST）](#tc-558-function-calling3-st)
- [TC-5.5.9 OpenAPI 暴露（2 ST）](#tc-559-openapi-暴露2-st)
- [TC-5.5.10 缓存层（2 ST）](#tc-5510-缓存层2-st)
- [TC-5.5.11 安全与脱敏（2 ST）](#tc-5511-安全与脱敏2-st)
- [TC-5.5.12 单测 + 集成（2 ST）](#tc-5512-单测--集成2-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.5.1 apps/tech-llmgw 初始化（2 ST）

#### ST-5.5.1.1 apps/tech-llmgw pyproject + 依赖

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-llmgw/pyproject.toml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(llmgw): scaffold |

**改动清单**：
1. uv init --package tech-llmgw
2. 加 langchain、langchain-openai、langchain-anthropic、httpx、redis

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.5.1.2 main.py + /healthz + docker-compose

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-llmgw/src/tech_llmgw/main.py、docker-compose.yml |
| 前置 ST | ST-5.5.1.1 |
| 输出 commit | feat(llmgw): main+compose |

**改动清单**：
1. FastAPI app + `/healthz`
2. docker-compose 加 tech-llmgw（端口 8008）

**DoD**：
- [ ] /healthz 200

---
### TC-5.5.2 LangChain 集成（3 ST）

#### ST-5.5.2.1 libs/llm 包初始化

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/pyproject.toml、src/llm/__init__.py |
| 前置 ST | TC-5.5.1 |
| 输出 commit | feat(llm): scaffold |

**改动清单**：
1. uv init --package llm
2. 导出统一接口

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.5.2.2 ChatProvider Protocol + LangChain 包装

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.2 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/chat.py |
| 前置 ST | ST-5.5.2.1 |
| 输出 commit | feat(llm): chat protocol |

**改动清单**：
1. `class ChatProvider(Protocol)`：async chat(messages, model) -> Message
2. LangChain 包装（统一 chat interface）

**DoD**：
- [ ] Protocol 定义完整

---

#### ST-5.5.2.3 chat 跑通（gpt-4o）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_chat.py |
| 前置 ST | ST-5.5.2.2 |
| 输出 commit | test(llm): chat gpt-4o |

**改动清单**：
1. `chat(messages, model="gpt-4o")` 跑通（mock HTTP）

**DoD**：
- [ ] mock 跑通

---
### TC-5.5.3 多 provider 路由（4 ST）

#### ST-5.5.3.1 OpenAI + Anthropic provider

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/providers/{openai,anthropic}.py |
| 前置 ST | TC-5.5.2 |
| 输出 commit | feat(llm): openai+anthropic |

**改动清单**：
1. 两个 provider class

**DoD**：
- [ ] 两个 provider 各 mock 跑通

---

#### ST-5.5.3.2 Qwen + Doubao provider

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/providers/{qwen,doubao}.py |
| 前置 ST | ST-5.5.3.1 |
| 输出 commit | feat(llm): qwen+doubao |

**改动清单**：
1. 两个 provider class

**DoD**：
- [ ] 两个 provider 各 mock 跑通

---

#### ST-5.5.3.3 router 按 model 字段路由

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/router.py |
| 前置 ST | ST-5.5.3.2 |
| 输出 commit | feat(llm): router |

**改动清单**：
1. `def get_provider(model: str) -> ChatProvider`

**DoD**：
- [ ] 4 provider 路由正确

---

#### ST-5.5.3.4 多 provider 端到端测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_router.py |
| 前置 ST | ST-5.5.3.3 |
| 输出 commit | test(llm): router 4 providers |

**改动清单**：
1. 4 个 provider 各跑通 1 次

**DoD**：
- [ ] 4/4 跑通

---
### TC-5.5.4 限流与配额（3 ST）

#### ST-5.5.4.1 RPM/TPM 限流器（Redis token bucket）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/quota.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): quota |

**改动清单**：
1. 每租户 RPM + TPM 限制（Redis token bucket）

**DoD**：
- [ ] 限流器工作

---

#### ST-5.5.4.2 超限排队 / 429

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/quota.py |
| 前置 ST | ST-5.5.4.1 |
| 输出 commit | feat(llmgw): quota 429 |

**改动清单**：
1. 超限 → 排队 30s → 成功；超时 → 429

**DoD**：
- [ ] 排队 + 429 逻辑

---

#### ST-5.5.4.3 限流单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_quota.py |
| 前置 ST | ST-5.5.4.2 |
| 输出 commit | test(llmgw): quota |

**改动清单**：
1. 故意超限 → 排队 30s 后成功

**DoD**：
- [ ] 限流验证

---
### TC-5.5.5 成本计量（2 ST）

#### ST-5.5.5.1 token 用量 + 单价 → llm_usage 表

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.5 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/cost.py、apps/tech-llmgw/migrations/001_llm_usage.sql |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): cost |

**改动清单**：
1. 每个请求记录 token 用量 + 单价
2. 写到 PG `llm_usage` 表

**DoD**：
- [ ] 表 + 写入逻辑

---

#### ST-5.5.5.2 日报 query 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.5 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_cost.py |
| 前置 ST | ST-5.5.5.1 |
| 输出 commit | test(llmgw): cost |

**改动清单**：
1. 日报 SQL query 正确

**DoD**：
- [ ] 日报可用

---
### TC-5.5.6 重试与 fallback（2 ST）

#### ST-5.5.6.1 主备 fallback 链配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.6 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/fallback.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): fallback |

**改动清单**：
1. 主模型 5xx/超时 → 自动 fallback 次选

**DoD**：
- [ ] 链路配置

---

#### ST-5.5.6.2 fallback 单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.6 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_fallback.py |
| 前置 ST | ST-5.5.6.1 |
| 输出 commit | test(llmgw): fallback |

**改动清单**：
1. mock 主 provider 失败 → 次选成功

**DoD**：
- [ ] fallback 工作

---
### TC-5.5.7 流式 SSE（2 ST）

#### ST-5.5.7.1 POST /api/v1/llm/chat/stream 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.7 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-llmgw/src/tech_llmgw/api/stream.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): stream |

**改动清单**：
1. StreamingResponse + SSE 格式

**DoD**：
- [ ] 端点工作

---

#### ST-5.5.7.2 EventSource 接收验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-llmgw/tests/test_stream.py |
| 前置 ST | ST-5.5.7.1 |
| 输出 commit | test(llmgw): stream |

**改动清单**：
1. 用 sse-starlette + httpx 测

**DoD**：
- [ ] 浏览器 EventSource 收到增量

---
### TC-5.5.8 Function calling（3 ST）

#### ST-5.5.8.1 tool schema 统一

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.8 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/tools.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): tools schema |

**改动清单**：
1. 统一 tool schema（OpenAI Function format）

**DoD**：
- [ ] schema 统一

---

#### ST-5.5.8.2 各 provider tool_calls 适配

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.8 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/providers/* |
| 前置 ST | ST-5.5.8.1 |
| 输出 commit | feat(llmgw): tool_calls |

**改动清单**：
1. OpenAI / Anthropic tool_calls 适配

**DoD**：
- [ ] 4 provider 适配

---

#### ST-5.5.8.3 tool 调用单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.8 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_tools.py |
| 前置 ST | ST-5.5.8.2 |
| 输出 commit | test(llmgw): tools |

**改动清单**：
1. openai/anthropic 工具调用各 1 例

**DoD**：
- [ ] 2/2 通过

---
### TC-5.5.9 OpenAPI 暴露（2 ST）

#### ST-5.5.9.1 /chat + /stream + /embeddings 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.9 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | apps/tech-llmgw/src/tech_llmgw/api.py |
| 前置 ST | TC-5.5.7、TC-5.5.8 |
| 输出 commit | feat(llmgw): openapi |

**改动清单**：
1. 3 端点集成到 main router

**DoD**：
- [ ] swagger-ui 列出

---

#### ST-5.5.9.2 openapi/paths/llmgw.yaml 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.9 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/paths/llmgw.yaml |
| 前置 ST | ST-5.5.9.1 |
| 输出 commit | docs(llmgw): openapi |

**改动清单**：
1. OpenAPI YAML 同步
2. CI lint 验证

**DoD**：
- [ ] CI lint 绿

---
### TC-5.5.10 缓存层（2 ST）

#### ST-5.5.10.1 Redis 缓存 hit/miss

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.10 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/cache.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): cache |

**改动清单**：
1. key = hash(prompt + temperature + model)
2. temperature=0 → 强制命中

**DoD**：
- [ ] 缓存工作

---

#### ST-5.5.10.2 缓存命中率 ≥30% 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.10 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_cache.py |
| 前置 ST | ST-5.5.10.1 |
| 输出 commit | test(llmgw): cache |

**改动清单**：
1. 跑 100 次重复 prompt → 命中率 ≥ 30%

**DoD**：
- [ ] 命中率达标

---
### TC-5.5.11 安全与脱敏（2 ST）

#### ST-5.5.11.1 敏感字段自动打码

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.11 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/llm/src/llm/safety.py |
| 前置 ST | TC-5.5.3 |
| 输出 commit | feat(llmgw): safety |

**改动清单**：
1. 正则识别手机号、身份证、邮箱
2. 送 LLM 前打码

**DoD**：
- [ ] 脱敏工作

---

#### ST-5.5.11.2 脱敏单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.11 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/test_safety.py |
| 前置 ST | ST-5.5.11.1 |
| 输出 commit | test(llmgw): safety |

**改动清单**：
1. 示例 input 输出验证打码

**DoD**：
- [ ] 打码正确

---
### TC-5.5.12 单测 + 集成（2 ST）

#### ST-5.5.12.1 tests/conftest.py fixtures + vcrpy

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/llm/tests/conftest.py |
| 前置 ST | TC-5.5.1 ~ TC-5.5.11 |
| 输出 commit | test(llmgw): conftest |

**改动清单**：
1. vcrpy 录 LLM 响应
2. redis / pg fixtures

**DoD**：
- [ ] fixtures 可复用

---

#### ST-5.5.12.2 覆盖率 ≥80% + CI 绿

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.5.12 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/llm/tests/、apps/tech-llmgw/tests/ |
| 前置 ST | ST-5.5.12.1 |
| 输出 commit | test(llmgw): full suite |

**改动清单**：
1. 补齐缺失测试

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

## W5-5 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-5 tech-llmgw | **是** | 12 | 29 | ~50h | 🟢 29/29 完成 (100%) ✅ |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-5 TC（12 条）拆出 ST（29 条） | 单回合执行避免 Token 超限 |